import asyncio
import hashlib
import logging
import re
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models import Video
from app.schemas import (
    AprobarRequest,
    IngestaRequest,
    IngestaResponse,
    MensajeResponse,
    VideoListResponse,
    VideoOut,
)
from app.worker import avanzar_ventana_transcripcion, subir_a_drive
from app.services.discovery import parse_tiktok_urls
from app.services.drive import eliminar_carpeta_video, obtener_carpeta_grupo, renombrar_carpeta
from app.config import settings as s

logger = logging.getLogger("maite.api")

router = APIRouter()

_corpus_lock = asyncio.Lock()
_background_tasks: set[asyncio.Task] = set()

# Estado global para el progreso de renombrado/sincronización de Drive
_drive_sync_progress = {
    "active": False,
    "current": 0,
    "total": 0,
    "message": ""
}


@router.get("/tasks/drive-sync-status")
async def obtener_estado_drive_sync():
    return _drive_sync_progress



def _background(task: asyncio.Task) -> None:
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)


async def get_db() -> AsyncSession:
    async with async_session() as session:
        yield session


@router.get("/oembed")
async def oembed_proxy(url: str = Query(...)):
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get("https://www.tiktok.com/oembed", params={"url": url})
            if resp.status_code != 200:
                return {"html": None}
            data = resp.json()
            return {"html": data.get("html")}
    except Exception:
        return {"html": None}


@router.post("/ingesta", response_model=IngestaResponse)
async def ingestar_pool(
    body: IngestaRequest,
    db: AsyncSession = Depends(get_db),
):
    logger.info("=== INGESTA RECIBIDA ===")
    logger.info("URLs manuales recibidas: %s", body.urls_manuales)
    logger.info("Hashtags: %s", body.hashtags_incluir)

    hashtags = body.hashtags_incluir or s.default_hashtags

    result = await db.execute(
        select(func.max(Video.shuffle_order))
    )
    max_order = result.scalar() or -1

    urls = list(dict.fromkeys(parse_tiktok_urls("\n".join(body.urls_manuales or []))))
    logger.info("URLs extraidas por regex: %s", urls)

    if not urls:
        urls = body.urls_manuales or []
        logger.info("Fallback a urls_manuales: %s", urls)

    if not urls:
        raise HTTPException(status_code=400, detail="No se proporcionaron URLs de TikTok válidas")

    videos = []
    seen_ids = set()
    for i, url in enumerate(urls):
        order = max_order + 1 + i
        clean_url = re.sub(r'\\u[0-9a-fA-F]{4}', lambda m: chr(int(m.group(0)[2:], 16)), url)
        # Limpiar la URL de parámetros de búsqueda (?q=...) y fragmentos (#...)
        clean_url = clean_url.split("?")[0].split("#")[0]
        
        raw_id = clean_url.rstrip("/").split("/")[-1].split(".")[0]
        vid_id = raw_id[:50]
        if not vid_id or len(vid_id) < 3:
            vid_id = hashlib.md5(clean_url.encode()).hexdigest()[:16]
        if vid_id in seen_ids:
            continue
        seen_ids.add(vid_id)
        username = "@pendiente"
        username_match = re.search(r"tiktok\.com/(@[\w.-]+)/video/", clean_url)
        if username_match:
            username = username_match.group(1)

        videos.append(
            Video(
                id=vid_id,
                url=clean_url,
                username=username,
                description="",
                hashtags=hashtags,
                duration_sec=None,
                status="pendiente",
                shuffle_order=order,
                created_at=datetime.now(timezone.utc),
            )
        )

    if not videos:
        logger.info("Todos los videos ya estaban en la base de datos")
        return IngestaResponse(total_candidatos=0, mensaje="Todos los videos ya estaban en el corpus")

    insertados = len(videos)
    try:
        db.add_all(videos)
        await db.commit()
    except Exception:
        await db.rollback()
        logger.warning("Algunos videos ya existian, insertando uno por uno...")
        insertados = 0
        for v in videos:
            async with async_session() as single_session:
                try:
                    single_session.add(v)
                    await single_session.commit()
                    insertados += 1
                except Exception:
                    await single_session.rollback()
                    logger.debug("Video %s ya existia, revisando estado...", v.id)
                    try:
                        existing = await single_session.get(Video, v.id)
                        if existing:
                            if existing.status == "error":
                                existing.status = "pendiente"
                                existing.error_message = None
                                existing.url = v.url
                                await single_session.commit()
                                insertados += 1
                                logger.info("Video %s reactivado de 'error' a 'pendiente'", v.id)
                            else:
                                logger.debug("Video %s ya existe con estado %s, ignorando", v.id, existing.status)
                    except Exception as inner_e:
                        logger.error("Error al reactivar video existente %s: %s", v.id, inner_e)
                        await single_session.rollback()
    logger.info("Guardados/Actualizados %d videos en DB", insertados)

    _background(asyncio.create_task(avanzar_ventana_transcripcion()))
    logger.info("Tarea avanzar_ventana_transcripcion encolada")

    return IngestaResponse(
        total_candidatos=insertados,
        mensaje=f"Ingesta completada: {insertados} candidatos agregados al pool",
    )


MAX_UPLOAD_SIZE = 500 * 1024 * 1024  # 500 MB


@router.post("/upload-video")
async def subir_video(
    video: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    tmp_dir = Path(s.tmp_audio_dir)
    tmp_dir.mkdir(parents=True, exist_ok=True)

    vid_id = hashlib.md5(str(uuid.uuid4()).encode()).hexdigest()[:16]
    video_path = tmp_dir / f"{vid_id}.mp4"

    total = 0
    with open(video_path, "wb") as buf:
        while chunk := await video.read(64 * 1024):
            total += len(chunk)
            if total > MAX_UPLOAD_SIZE:
                buf.close()
                video_path.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="El archivo excede el tamaño máximo permitido (500 MB)")
            buf.write(chunk)

    new_video = Video(
        id=vid_id,
        url=f"file://{video_path}",
        username="@upload",
        description=f"Subido desde extensión: {video.filename or 'video.mp4'}",
        hashtags=[],
        duration_sec=None,
        status="pendiente",
        shuffle_order=int(datetime.now().timestamp()),
        created_at=datetime.now(timezone.utc),
    )
    db.add(new_video)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        video_path.unlink(missing_ok=True)
        raise

    _background(asyncio.create_task(avanzar_ventana_transcripcion()))

    return JSONResponse({
        "status": "ok",
        "video_id": vid_id,
        "mensaje": "Video recibido, procesando transcripción...",
    })


@router.get("/videos/{video_id}", response_model=VideoOut)
async def obtener_video(
    video_id: str,
    db: AsyncSession = Depends(get_db),
):
    video = await db.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video no encontrado")
    return VideoOut.model_validate(video)


@router.get("/videos", response_model=VideoListResponse)
async def listar_videos(
    status: str = Query("listo_para_triage"),
    limit: int = Query(20, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    statuses = [s.strip() for s in status.split(",")]
    if len(statuses) == 1:
        count_q = select(func.count(Video.id)).where(Video.status == statuses[0])
        total = await db.scalar(count_q)
        q = (
            select(Video)
            .where(Video.status == statuses[0])
            .order_by(Video.shuffle_order)
            .offset(offset)
            .limit(limit)
        )
    else:
        count_q = select(func.count(Video.id)).where(Video.status.in_(statuses))
        total = await db.scalar(count_q)
        q = (
            select(Video)
            .where(Video.status.in_(statuses))
            .order_by(Video.shuffle_order)
            .offset(offset)
            .limit(limit)
        )
    result = await db.execute(q)
    videos = result.scalars().all()

    return VideoListResponse(
        videos=[VideoOut.model_validate(v) for v in videos],
        total=total or 0,
    )


@router.post("/videos/{video_id}/aprobar", response_model=MensajeResponse)
async def aprobar_video(
    video_id: str,
    body: AprobarRequest,
    db: AsyncSession = Depends(get_db),
):
    video = await db.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video no encontrado")
    if video.status not in ("listo_para_triage", "pendiente"):
        raise HTTPException(
            status_code=400,
            detail=f"El video está en estado {video.status}, no se puede aprobar",
        )

    logger.info("=== APROBANDO VIDEO %s ===", video_id)
    logger.info("Segmentos editados: %d", len(body.transcript_editada or []))

    # Convertir TranscriptSegment objects a dicts para serialización JSON
    editada_dicts = [seg.model_dump() for seg in (body.transcript_editada or [])]

    # Asignar numero de corpus secuencial (con lock para evitar race condition)
    async with _corpus_lock:
        max_num = await db.scalar(select(func.max(Video.corpus_number)))
        corpus_number = (max_num or 0) + 1
        video.corpus_number = corpus_number
        video.status = "aprobado"
        video.transcript_editada = editada_dicts
        video.approved_at = datetime.now(timezone.utc)
        await db.commit()

    txt_dir = Path(s.tmp_audio_dir)
    username_clean = (video.username or "@desconocido").lstrip("@").replace(" ", "_")[:30]
    folder_label = f"{corpus_number:03d}_{username_clean}"

    # Guardar solo la transcripcion en corpus/
    loop = asyncio.get_event_loop()
    corpus_dir = Path("corpus")
    corpus_dir.mkdir(exist_ok=True)
    txt_name = f"{folder_label}.txt"
    corpus_txt = corpus_dir / txt_name
    logger.info("Guardando transcripcion en %s", corpus_txt)

    def _guardar_corpus():
        with open(corpus_txt, "w", encoding="utf-8") as f:
            for seg in editada_dicts:
                text = seg.get("text", "") if seg else ""
                if text:
                    f.write(f"{text}\n")
        txt_path = txt_dir / f"{video_id}.txt"
        shutil.copy2(corpus_txt, txt_path)
        meta_path = txt_dir / f"{video_id}_metadata.txt"
        with open(meta_path, "w", encoding="utf-8") as f:
            f.write(f"URL: {video.url}\n")
            hashtags = video.hashtags or []
            if hashtags:
                f.write(f"Hashtags: {', '.join(hashtags)}\n")

    await loop.run_in_executor(None, _guardar_corpus)

    _background(asyncio.create_task(subir_a_drive(video_id, corpus_number)))
    _background(asyncio.create_task(avanzar_ventana_transcripcion()))

    return MensajeResponse(mensaje="Video aprobado correctamente")


@router.post("/videos/{video_id}/rechazar", response_model=MensajeResponse)
async def rechazar_video(
    video_id: str,
    db: AsyncSession = Depends(get_db),
):
    video = await db.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video no encontrado")
    if video.status not in ("listo_para_triage", "pendiente"):
        raise HTTPException(
            status_code=400,
            detail=f"El video está en estado {video.status}, no se puede rechazar",
        )

    logger.info("=== RECHAZANDO VIDEO %s ===", video_id)

    # Eliminar archivos temporales
    loop = asyncio.get_event_loop()
    tmp_dir = Path(s.tmp_audio_dir)

    def _limpiar_tmp():
        for f in tmp_dir.glob(f"{video_id}.*"):
            f.unlink(missing_ok=True)

    await loop.run_in_executor(None, _limpiar_tmp)

    # Eliminar registro permanente
    await db.delete(video)
    await db.commit()
    logger.info("Video %s eliminado permanentemente", video_id)

    _background(asyncio.create_task(avanzar_ventana_transcripcion()))

    return MensajeResponse(mensaje="Video rechazado y eliminado")


async def _background_drive_sync(
    video_id: str,
    deleted_number: int | None,
    username: str | None,
    renames: list[tuple]
):
    global _drive_sync_progress
    _drive_sync_progress["active"] = True
    _drive_sync_progress["current"] = 0
    _drive_sync_progress["total"] = (1 if deleted_number else 0) + len(renames)
    
    loop = asyncio.get_event_loop()
    
    # 1. Eliminar carpeta del video en Drive
    if deleted_number and username:
        username_clean = (username or "@desconocido").lstrip("@").replace(" ", "_")[:30]
        drive_folder = f"{deleted_number:03d}_{username_clean}"
        _drive_sync_progress["message"] = f"Eliminando carpeta '{drive_folder}' de Google Drive..."
        try:
            drive_ok = await loop.run_in_executor(
                None, eliminar_carpeta_video, video_id, s.google_drive_folder_id, drive_folder
            )
            if drive_ok:
                logger.info("Carpeta '%s' eliminada de Drive OK", drive_folder)
            else:
                logger.warning("No se pudo eliminar '%s' en Drive", drive_folder)
        except Exception as e:
            logger.error("Error al eliminar carpeta en Drive: %s", e)
        
        _drive_sync_progress["current"] += 1

    # 2. Renombrar carpetas de los videos siguientes en Drive
    for vid, parent_id, old_label, new_label in renames:
        _drive_sync_progress["message"] = f"Renombrando carpeta {old_label} a {new_label} en Drive..."
        try:
            await loop.run_in_executor(None, renombrar_carpeta, vid, parent_id, old_label, new_label)
        except Exception as e:
            logger.warning("No se pudo renombrar carpeta en Drive: %s", e)
        
        _drive_sync_progress["current"] += 1

    # Finalizar
    _drive_sync_progress["active"] = False
    _drive_sync_progress["message"] = "Actualización de Google Drive completada."


@router.delete("/videos/{video_id}", response_model=MensajeResponse)
async def eliminar_video(
    video_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    logger.info("=== ELIMINANDO VIDEO %s ===", video_id)

    async with _corpus_lock:
        video = await db.get(Video, video_id)
        if not video:
            logger.info("Video %s no estaba en la DB", video_id)
            loop = asyncio.get_event_loop()
            tmp_dir = Path(s.tmp_audio_dir)
            await loop.run_in_executor(None, lambda: [f.unlink(missing_ok=True) for f in tmp_dir.glob(f"{video_id}.*")])
            return MensajeResponse(mensaje="Video no encontrado o ya eliminado")

        deleted_number = video.corpus_number
        username = video.username

        # Eliminar de la base de datos
        await db.delete(video)
        await db.commit()
        logger.info("Video %s eliminado de la DB", video_id)

        # Eliminar archivos locales
        if deleted_number:
            username_clean = (username or "@desconocido").lstrip("@").replace(" ", "_")[:30]
            folder_label = f"{deleted_number:03d}_{username_clean}"
            for ext in [".txt"]:
                (Path("corpus") / f"{folder_label}{ext}").unlink(missing_ok=True)

        # Renumerar videos siguientes en DB y renombrar archivos locales
        renames = []
        if deleted_number:
            result = await db.execute(
                select(Video).where(Video.corpus_number > deleted_number).order_by(Video.corpus_number)
            )
            for v in result.scalars():
                old_num = v.corpus_number
                new_num = old_num - 1
                v.corpus_number = new_num

                # Renombrar archivos locales
                u = (v.username or "@desconocido").lstrip("@").replace(" ", "_")[:30]
                old_label = f"{old_num:03d}_{u}"
                new_label = f"{new_num:03d}_{u}"
                for ext in [".txt"]:
                    old = Path("corpus") / f"{old_label}{ext}"
                    new = Path("corpus") / f"{new_label}{ext}"
                    if old.exists():
                        old.rename(new)

                renames.append((v.id, s.google_drive_folder_id, old_label, new_label))

            await db.commit()

        # Encolar tareas pesadas de Drive en segundo plano
        if deleted_number:
            background_tasks.add_task(
                _background_drive_sync,
                video_id,
                deleted_number,
                username,
                renames
            )
        else:
            loop = asyncio.get_event_loop()
            tmp_dir = Path(s.tmp_audio_dir)
            await loop.run_in_executor(None, lambda: [f.unlink(missing_ok=True) for f in tmp_dir.glob(f"{video_id}.*")])

    return MensajeResponse(mensaje="Video eliminado. Sincronización de Drive en segundo plano iniciada.")


@router.get("/video-file/{video_id}")
async def servir_video(video_id: str):
    video_path = Path(s.tmp_audio_dir) / f"{video_id}.mp4"
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Video no encontrado en el servidor")
    return FileResponse(str(video_path), media_type="video/mp4")


@router.post("/videos/reintentar-errores", response_model=MensajeResponse)
async def reintentar_errores(db: AsyncSession = Depends(get_db)):
    stmt = update(Video).where(Video.status == "error").values(status="pendiente")
    result = await db.execute(stmt)
    await db.commit()
    count = result.rowcount
    if count > 0:
        _background(asyncio.create_task(avanzar_ventana_transcripcion()))
    return MensajeResponse(mensaje=f"{count} videos reencolados para transcripcion")


@router.post("/videos/{video_id}/reintentar", response_model=MensajeResponse)
async def reintentar_video(
    video_id: str,
    db: AsyncSession = Depends(get_db),
):
    video = await db.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video no encontrado")
    if video.status != "error":
        raise HTTPException(status_code=400, detail=f"El video está en estado {video.status}, no se puede reintentar")

    logger.info("=== REINTENTANDO VIDEO %s ===", video_id)
    if video.url and not video.url.startswith("file://"):
        video.url = video.url.split("?")[0].split("#")[0]
    video.status = "pendiente"
    video.error_message = None
    await db.commit()
    _background(asyncio.create_task(avanzar_ventana_transcripcion()))
    return MensajeResponse(mensaje="Video reencolado para transcripcion")


_corpus_sync_progress = {
    "active": False,
    "current": 0,
    "total": 0,
    "message": "",
    "created": 0,
    "ok": 0,
    "deleted": 0,
}


@router.get("/corpus/sync-txt-status")
async def obtener_estado_corpus_sync():
    return _corpus_sync_progress


def _parse_corpus_number(filename: str) -> int | None:
    try:
        return int(filename[:3])
    except (ValueError, IndexError):
        return None


async def _sync_corpus_txt_files():
    global _corpus_sync_progress
    _corpus_sync_progress["active"] = True
    _corpus_sync_progress["current"] = 0
    _corpus_sync_progress["created"] = 0
    _corpus_sync_progress["ok"] = 0
    _corpus_sync_progress["deleted"] = 0
    _corpus_sync_progress["message"] = "Iniciando sincronizacion de archivos .txt..."

    loop = asyncio.get_event_loop()
    corpus_dir = Path("corpus")
    corpus_dir.mkdir(exist_ok=True)

    async with async_session() as session:
        result = await session.execute(
            select(Video)
            .where(Video.status == "aprobado")
            .order_by(Video.corpus_number)
        )
        aprobados = result.scalars().all()

        # Construir set de nombres esperados y mapeo numero -> nombre esperado
        expected_files: set[str] = set()
        expected_by_number: dict[int, str] = {}

        for v in aprobados:
            if not v.corpus_number:
                continue
            username_clean = (v.username or "@desconocido").lstrip("@").replace(" ", "_")[:30]
            txt_name = f"{v.corpus_number:03d}_{username_clean}.txt"
            expected_files.add(txt_name)
            expected_by_number[v.corpus_number] = txt_name

        _corpus_sync_progress["total"] = len(aprobados) + len(list(corpus_dir.glob("*.txt")))

        # Fase 1: crear .txt faltantes para cada video aprobado
        for v in aprobados:
            if not v.corpus_number or not v.transcript_editada:
                _corpus_sync_progress["current"] += 1
                _corpus_sync_progress["ok"] += 1
                continue

            username_clean = (v.username or "@desconocido").lstrip("@").replace(" ", "_")[:30]
            txt_name = f"{v.corpus_number:03d}_{username_clean}.txt"
            txt_path = corpus_dir / txt_name

            if txt_path.exists():
                _corpus_sync_progress["current"] += 1
                _corpus_sync_progress["ok"] += 1
                continue

            _corpus_sync_progress["message"] = f"Creando {txt_name}..."

            def _escribir_txt(path, transcript):
                with open(path, "w", encoding="utf-8") as f:
                    for seg in transcript:
                        text = seg.get("text", "") if isinstance(seg, dict) else ""
                        if text:
                            f.write(f"{text}\n")

            await loop.run_in_executor(None, _escribir_txt, txt_path, v.transcript_editada)
            _corpus_sync_progress["current"] += 1
            _corpus_sync_progress["created"] += 1
            logger.info("Creado %s", txt_name)

        # Fase 2: limpiar archivos huerfanos o duplicados
        all_txt = sorted(corpus_dir.glob("*.txt"))
        for txt_path in all_txt:
            fname = txt_path.name
            if fname in expected_files:
                continue

            parsed_num = _parse_corpus_number(fname)
            deleted = False

            if parsed_num is not None and parsed_num in expected_by_number:
                # Duplicado: mismo numero pero distinto username -> renombramiento viejo
                _corpus_sync_progress["message"] = f"Eliminando duplicado {fname}..."
                await loop.run_in_executor(None, txt_path.unlink, True)
                deleted = True
                logger.info("Eliminado duplicado %s (esperado: %s)", fname, expected_by_number[parsed_num])
            elif parsed_num is not None and parsed_num not in expected_by_number:
                # Huerfano: el video con ese numero ya no esta aprobado
                _corpus_sync_progress["message"] = f"Eliminando huerfano {fname}..."
                await loop.run_in_executor(None, txt_path.unlink, True)
                deleted = True
                logger.info("Eliminado huerfano %s", fname)

            if deleted:
                _corpus_sync_progress["deleted"] += 1
            _corpus_sync_progress["current"] += 1

    _corpus_sync_progress["active"] = False
    parts = [f"{_corpus_sync_progress['created']} creados", f"{_corpus_sync_progress['ok']} ya existian"]
    if _corpus_sync_progress["deleted"]:
        parts.append(f"{_corpus_sync_progress['deleted']} eliminados")
    _corpus_sync_progress["message"] = f"Sincronizacion completada. {', '.join(parts)}."


@router.post("/corpus/sync-txt", response_model=MensajeResponse)
async def sincronizar_corpus_txt():
    global _corpus_sync_progress
    if _corpus_sync_progress["active"]:
        raise HTTPException(status_code=400, detail="Ya hay una sincronizacion en curso")
    _background(asyncio.create_task(_sync_corpus_txt_files()))
    return MensajeResponse(mensaje="Sincronizacion de archivos .txt iniciada en segundo plano")


@router.get("/corpus/verify-txt")
async def verificar_corpus_txt(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Video)
        .where(Video.status == "aprobado")
        .order_by(Video.corpus_number)
    )
    aprobados = result.scalars().all()

    corpus_dir = Path("corpus")
    existing_files: dict[str, Path] = {p.name: p for p in corpus_dir.glob("*.txt")}

    expected_files: set[str] = set()
    expected_by_number: dict[int, str] = {}
    missing: list[dict] = []
    orphans: list[str] = []
    duplicates: list[dict] = []

    for v in aprobados:
        if not v.corpus_number:
            continue
        username_clean = (v.username or "@desconocido").lstrip("@").replace(" ", "_")[:30]
        txt_name = f"{v.corpus_number:03d}_{username_clean}.txt"
        expected_files.add(txt_name)
        expected_by_number[v.corpus_number] = txt_name

        if txt_name not in existing_files:
            missing.append({
                "corpus_number": v.corpus_number,
                "expected_file": txt_name,
                "video_id": v.id,
            })

    for fname in existing_files:
        if fname in expected_files:
            continue
        parsed = _parse_corpus_number(fname)
        if parsed is not None and parsed in expected_by_number:
            duplicates.append({
                "file": fname,
                "expected": expected_by_number[parsed],
            })
        else:
            orphans.append(fname)

    return {
        "ok": len(missing) == 0 and len(orphans) == 0 and len(duplicates) == 0,
        "total_aprobados": len(aprobados),
        "total_txt": len(existing_files),
        "missing": missing,
        "orphans": orphans,
        "duplicates": duplicates,
    }


@router.post("/videos/{video_id}/cancelar-cola", response_model=MensajeResponse)
async def cancelar_de_cola(
    video_id: str,
    db: AsyncSession = Depends(get_db),
):
    video = await db.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video no encontrado")
    if video.status not in ("pendiente", "descargando", "transcribiendo"):
        raise HTTPException(status_code=400, detail=f"El video está en estado {video.status}, no se puede cancelar")

    await db.delete(video)
    await db.commit()
    logger.info("Video %s cancelado de la cola", video_id)

    loop = asyncio.get_event_loop()
    tmp_dir = Path(s.tmp_audio_dir)
    await loop.run_in_executor(None, lambda: [f.unlink(missing_ok=True) for f in tmp_dir.glob(f"{video_id}.*")])

    return MensajeResponse(mensaje="Video cancelado de la cola")
