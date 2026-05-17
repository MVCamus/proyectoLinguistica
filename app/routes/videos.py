import asyncio
import logging
from datetime import datetime, timezone
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import select, func
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
from app.services.drive import eliminar_carpeta_video, renombrar_carpeta
from app.config import settings as s

logger = logging.getLogger("maite.api")

router = APIRouter()


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

    hashtags = body.hashtags_incluir or ["noticias", "aprendeentiktok", "español"]

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

    import hashlib, re
    from sqlalchemy import exists as sa_exists
    videos = []
    seen_ids = set()
    for i, url in enumerate(urls):
        order = max_order + 1 + i
        clean_url = re.sub(r'\\u[0-9a-fA-F]{4}', lambda m: chr(int(m.group(0)[2:], 16)), url)
        raw_id = clean_url.rstrip("/").split("/")[-1].split("?")[0].split(".")[0]
        vid_id = raw_id[:50]
        if not vid_id or len(vid_id) < 3:
            vid_id = hashlib.md5(clean_url.encode()).hexdigest()[:16]
        if vid_id in seen_ids:
            continue
        seen_ids.add(vid_id)
        videos.append(
            Video(
                id=vid_id,
                url=url,
                username="@pendiente",
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

    try:
        db.add_all(videos)
        await db.commit()
    except Exception:
        await db.rollback()
        logger.warning("Algunos videos ya existian, insertando uno por uno...")
        insertados = 0
        for v in videos:
            try:
                db.add(v)
                await db.commit()
                insertados += 1
            except Exception:
                await db.rollback()
                logger.debug("Video %s ya existia, saltando", v.id)
        videos = videos[:insertados]
    logger.info("Guardados %d videos en DB", len(videos))
    for v in videos:
        logger.debug("  -> %s | %s", v.id, v.url)

    asyncio.create_task(avanzar_ventana_transcripcion())
    logger.info("Tarea avanzar_ventana_transcripcion encolada")

    return IngestaResponse(
        total_candidatos=len(videos),
        mensaje=f"Ingesta completada: {len(videos)} candidatos agregados al pool",
    )


@router.post("/upload-video")
async def subir_video(
    video: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    tmp_dir = Path(s.tmp_audio_dir)
    tmp_dir.mkdir(parents=True, exist_ok=True)

    import hashlib, uuid
    vid_id = hashlib.md5(str(uuid.uuid4()).encode()).hexdigest()[:16]
    video_path = tmp_dir / f"{vid_id}.mp4"

    content = await video.read()
    video_path.write_bytes(content)

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
    await db.commit()

    asyncio.create_task(avanzar_ventana_transcripcion())

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

    # Asignar numero de corpus secuencial
    max_num = await db.scalar(select(func.max(Video.corpus_number)))
    corpus_number = (max_num or 0) + 1
    video.corpus_number = corpus_number
    video.status = "aprobado"
    video.transcript_editada = body.transcript_editada
    video.approved_at = datetime.now(timezone.utc)
    await db.commit()

    txt_dir = Path(s.tmp_audio_dir)
    username_clean = (video.username or "@desconocido").lstrip("@").replace(" ", "_")[:30]
    folder_label = f"{corpus_number:03d}_{username_clean}"

    # Guardar solo la transcripcion en corpus/
    corpus_dir = Path("corpus")
    corpus_dir.mkdir(exist_ok=True)
    txt_name = f"{folder_label}.txt"
    corpus_txt = corpus_dir / txt_name
    logger.info("Guardando transcripcion en %s", corpus_txt)
    with open(corpus_txt, "w", encoding="utf-8") as f:
        for seg in (body.transcript_editada or []):
            text = seg.get("text", "")
            if text:
                f.write(f"{text}\n")

    # Guardar transcripcion y metadata en tmp/ para subir a Drive
    import shutil
    txt_path = txt_dir / f"{video_id}.txt"
    shutil.copy2(corpus_txt, txt_path)
    meta_path = txt_dir / f"{video_id}_metadata.txt"
    with open(meta_path, "w", encoding="utf-8") as f:
        f.write(f"URL: {video.url}\n")
        hashtags = video.hashtags or []
        if hashtags:
            f.write(f"Hashtags: {', '.join(hashtags)}\n")

    asyncio.create_task(subir_a_drive(video_id, corpus_number))

    asyncio.create_task(avanzar_ventana_transcripcion())

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
    tmp_dir = Path(s.tmp_audio_dir)
    for f in tmp_dir.glob(f"{video_id}.*"):
        f.unlink(missing_ok=True)

    # Eliminar registro permanente
    await db.delete(video)
    await db.commit()
    logger.info("Video %s eliminado permanentemente", video_id)

    asyncio.create_task(avanzar_ventana_transcripcion())

    return MensajeResponse(mensaje="Video rechazado y eliminado")


@router.delete("/videos/{video_id}", response_model=MensajeResponse)
async def eliminar_video(
    video_id: str,
    db: AsyncSession = Depends(get_db),
):
    logger.info("=== ELIMINANDO VIDEO %s ===", video_id)

    video = await db.get(Video, video_id)
    deleted_number = video.corpus_number if video else None

    if video:
        await db.delete(video)
        await db.commit()
        logger.info("Video %s eliminado de la DB", video_id)

        # Eliminar archivos locales
        username_clean = (video.username or "@desconocido").lstrip("@").replace(" ", "_")[:30]
        folder_label = f"{deleted_number:03d}_{username_clean}" if deleted_number else video_id
        for ext in [".txt"]:
            (Path("corpus") / f"{folder_label}{ext}").unlink(missing_ok=True)

        # Eliminar carpeta de Drive
        if deleted_number:
            drive_folder = f"{deleted_number:03d}_{username_clean}"
            eliminar_carpeta_video(video_id, s.google_drive_folder_id, drive_folder)

        # Renumerar videos siguientes
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

                # Renombrar carpeta en Drive
                try:
                    renombrar_carpeta(v.id, s.google_drive_folder_id, old_label, new_label)
                except Exception as e:
                    logger.warning("No se pudo renombrar carpeta en Drive: %s", e)

            await db.commit()
    else:
        logger.info("Video %s no estaba en la DB", video_id)
        tmp_dir = Path(s.tmp_audio_dir)
        for f in tmp_dir.glob(f"{video_id}.*"):
            f.unlink(missing_ok=True)

    return MensajeResponse(mensaje="Video eliminado permanentemente")


@router.get("/video-file/{video_id}")
async def servir_video(video_id: str):
    video_path = Path(s.tmp_audio_dir) / f"{video_id}.mp4"
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Video no encontrado en el servidor")
    return FileResponse(str(video_path), media_type="video/mp4")


@router.post("/videos/reintentar-errores", response_model=MensajeResponse)
async def reintentar_errores(db: AsyncSession = Depends(get_db)):
    from sqlalchemy import update
    stmt = update(Video).where(Video.status == "error").values(status="pendiente")
    result = await db.execute(stmt)
    await db.commit()
    count = result.rowcount
    if count > 0:
        asyncio.create_task(avanzar_ventana_transcripcion())
    return MensajeResponse(mensaje=f"{count} videos reencolados para transcripcion")


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

    tmp_dir = Path(s.tmp_audio_dir)
    for f in tmp_dir.glob(f"{video_id}.*"):
        f.unlink(missing_ok=True)

    return MensajeResponse(mensaje="Video cancelado de la cola")
