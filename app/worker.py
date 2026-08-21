import asyncio
import logging
import re
from pathlib import Path

import yt_dlp as yt
from sqlalchemy import select, func
from sqlalchemy.orm.exc import StaleDataError

from app.config import settings as s
from app.database import async_session
from app.models import Video
from app.services.downloader import descargar_audio
from app.services.drive import (
    obtener_carpeta_grupo,
    subir_transcripcion,
    subir_video,
    subir_txt_en_carpeta,
)
from app.services.transcriber import transcribir

logger = logging.getLogger("tiktok_scraping.worker")

_ventana_lock = asyncio.Lock()
_background_tasks: set[asyncio.Task] = set()


def _background(task: asyncio.Task) -> None:
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)


async def transcribir_video(video_id: str):
    logger.info("=== TRANSCRIBIR VIDEO %s ===", video_id)
    tmp_dir = s.tmp_dir
    tmp_dir.mkdir(parents=True, exist_ok=True)

    session = async_session()
    try:
        video = await session.get(Video, video_id)
        if not video:
            logger.warning("Video %s no encontrado en DB", video_id)
            return {"status": "saltado", "motivo": f"video {video_id} no encontrado"}
        if video.status != "pendiente":
            logger.info("Video %s no esta pendiente (status=%s), saltando", video_id, video.status)
            return {"status": "saltado", "motivo": f"video {video_id} no disponible para transcripcion"}

        video.status = "descargando"
        await session.commit()
        logger.info("Video %s marcado como 'descargando'", video_id)
        logger.info("URL del video: %s", video.url)

        url_extract = video.url.split("?")[0].split("#")[0] if not video.url.startswith("file://") else video.url
        try:
            loop = asyncio.get_event_loop()
            with yt.YoutubeDL({
                "quiet": True,
                "no_warnings": True,
                "http_headers": {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
                    "Referer": "https://www.tiktok.com/",
                },
            }) as ydl:
                info = await loop.run_in_executor(None, lambda: ydl.extract_info(url_extract, download=False))
                if info:
                    username = info.get("uploader") or info.get("channel") or info.get("creator") or video.username
                    if username and username != video.username:
                        video.username = f"@{username}" if not username.startswith("@") else username
                        logger.info("Username actualizado: %s", video.username)
                    if info.get("description") and not video.description:
                        video.description = info.get("description", "")[:1000]
                    hashtags = []
                    if info.get("tags"):
                        hashtags.extend(info["tags"])
                    if info.get("description"):
                        hashtags.extend(re.findall(r'#(\w+)', info["description"]))
                    if hashtags:
                        video.hashtags = [f"#{t}" if not t.startswith("#") else t for t in hashtags][:20]
                    if info.get("duration") and not video.duration_sec:
                        video.duration_sec = int(info.get("duration", 0))
                    await session.commit()
        except Exception as e:
            logger.warning("No se pudo extraer metadata con yt-dlp: %s", e)

        if video.username == "@pendiente" and video.url:
            username_match = re.search(r"tiktok\.com/(@[\w.-]+)/video/", video.url)
            if username_match:
                video.username = username_match.group(1)
                await session.commit()
                logger.info("Username extraído del URL (fallback): %s", video.username)

        logger.info("Descargando audio...")
        audio_path = await loop.run_in_executor(None, descargar_audio, video.url, video_id, tmp_dir)
        logger.info("Audio descargado: %s (%.1f MB)", audio_path, audio_path.stat().st_size / 1024 / 1024)

        video.status = "transcribiendo"
        await session.commit()
        logger.info("Video %s marcado como 'transcribiendo'", video_id)

        logger.info("Transcribiendo audio...")
        segmentos = await loop.run_in_executor(None, transcribir, audio_path, s.whisper_language, video_id)
        logger.info("Transcripcion completada: %d segmentos", len(segmentos))
        for i, seg in enumerate(segmentos[:3]):
            logger.debug("  seg %d: [%.2f -> %.2f] %s", i, seg["start"], seg["end"], seg["text"][:80])
        if len(segmentos) > 3:
            logger.debug("  ... y %d segmentos mas", len(segmentos) - 3)

        video.transcript_original = segmentos
        video.status = "listo_para_triage"
        video.error_message = None
        await session.commit()
        logger.info("Video %s listo para triage", video_id)

        await loop.run_in_executor(None, lambda: audio_path.unlink(missing_ok=True))
        logger.info("Audio temporal eliminado")

        logger.info("Video completado, revisando si hay mas en cola...")
        _background(asyncio.create_task(avanzar_ventana_transcripcion()))

        return {"status": "ok", "video_id": video_id, "segmentos": len(segmentos)}

    except StaleDataError:
        logger.warning("Video %s ya fue eliminado por otro proceso, saltando", video_id)
        await session.rollback()
        return {"status": "saltado", "motivo": "video eliminado por otro proceso"}
    except Exception as exc:
        logger.error("Error procesando video %s: %s", video_id, exc)
        try:
            await session.rollback()
        except Exception:
            logger.warning("Error haciendo rollback de la sesion", exc_info=True)
        try:
            video = await session.get(Video, video_id)
            if video:
                video.status = "error"
                err_str = str(exc).lower()
                if any(x in err_str for x in ("rehydration", "webpage request", "429", "too many requests", "captcha", "challenge")):
                    err_msg = "Límite de descargas de TikTok alcanzado (muchas descargas en poco tiempo). Por favor, intenta de nuevo en unos minutos o cambia de red."
                else:
                    err_msg = f"Error de procesamiento: {str(exc).strip() or repr(exc)}"
                video.error_message = err_msg
                await session.commit()
                logger.error("Video %s marcado como 'error'", video_id)
        except StaleDataError:
            logger.warning("Video %s ya no existe en DB", video_id)
        except Exception as e:
            logger.warning("No se pudo marcar video %s como error: %s", video_id, e)
        return {"status": "error", "video_id": video_id, "motivo": str(exc) or repr(exc)}

    finally:
        await session.close()


async def avanzar_ventana_transcripcion():
    async with _ventana_lock:
        logger.info("=== AVANZAR VENTANA TRANSCRIPCION ===")
        session = async_session()
        try:
            en_proceso = await session.scalar(
                select(func.count(Video.id)).where(Video.status.in_(["descargando", "transcribiendo"]))
            ) or 0

            if en_proceso > 0:
                logger.info("Ya hay %d videos en proceso, no se encolan mas por ahora", en_proceso)
                return {"encolados": 0, "en_proceso": en_proceso}

            result = await session.execute(
                select(Video)
                .where(Video.status == "pendiente")
                .order_by(Video.shuffle_order)
                .limit(1)
            )
            pendientes = result.scalars().all()

            logger.info("Videos pendientes encontrados: %d", len(pendientes))

            for video in pendientes:
                logger.info("Encolando transcripcion para video %s", video.id)
                _background(asyncio.create_task(transcribir_video(video.id)))

            return {"encolados": len(pendientes)}

        finally:
            await session.close()


async def subir_a_drive(video_id: str, corpus_number: int | None = None, max_retries: int = 3):
    for attempt in range(max_retries + 1):
        logger.info("=== SUBIR A DRIVE %s (intento %d/%d) ===", video_id, attempt + 1, max_retries + 1)
        tmp_dir = s.tmp_dir
        tmp_dir.mkdir(parents=True, exist_ok=True)

        session = async_session()
        try:
            video = await session.get(Video, video_id)
            if not video or video.status != "aprobado":
                logger.warning("Video %s no esta aprobado, saltando subida a Drive", video_id)
                return {"status": "saltado", "motivo": f"video {video_id} no esta en estado aprobado"}

            loop = asyncio.get_event_loop()

            audio_path = tmp_dir / f"{video_id}.mp3"
            if not audio_path.exists():
                logger.info("Audio mp3 no encontrado localmente, re-descargando...")
                await loop.run_in_executor(None, descargar_audio, video.url, video_id, tmp_dir)
            else:
                logger.info("Audio mp3 encontrado: %s", audio_path)

            txt_path = tmp_dir / f"{video_id}.txt"
            if not txt_path.exists():
                logger.info("TXT no encontrado, generando desde transcript_editada...")

                def _generar_txt():
                    with open(txt_path, "w", encoding="utf-8") as f:
                        for seg in (video.transcript_editada or []):
                            text = seg.get("text", "")
                            if text:
                                f.write(f"{text}\n")

                await loop.run_in_executor(None, _generar_txt)
            else:
                logger.info("TXT encontrado: %s", txt_path)

            cnum = corpus_number or video.corpus_number
            if not cnum:
                logger.error("Video %s no tiene corpus_number asignado, abortando subida", video_id)
                return {"status": "error", "motivo": "sin corpus_number"}

            folder_id = await loop.run_in_executor(None, obtener_carpeta_grupo, cnum, s.google_drive_folder_id)
            username_clean = (video.username or "@desconocido").lstrip("@").replace(" ", "_")[:30]
            folder_name = f"{cnum:03d}_{username_clean}"
            meta_path = tmp_dir / f"{video_id}_metadata.txt"

            mp4_path = tmp_dir / f"{video_id}.mp4"
            if mp4_path.exists():
                logger.info("Subiendo video mp4 a Drive...")
                drive_url_video = await loop.run_in_executor(None, subir_video, mp4_path, video_id, folder_id, folder_name)
                logger.info("Video subido: %s", drive_url_video)
                logger.info("Subiendo transcripcion txt a la misma carpeta...")
                drive_url_txt = await loop.run_in_executor(None, subir_txt_en_carpeta, txt_path, video_id, folder_id, folder_name)
                logger.info("TXT subido: %s", drive_url_txt)
                if meta_path.exists():
                    logger.info("Subiendo metadata a la misma carpeta...")
                    await loop.run_in_executor(None, subir_txt_en_carpeta, meta_path, video_id, folder_id, folder_name, f"{video_id}_metadata.txt")
            else:
                drive_url_video = None
                logger.warning("Video mp4 no encontrado, subiendo solo el txt a la raiz")
                drive_url_txt = await loop.run_in_executor(None, subir_transcripcion, txt_path, folder_id)
                if meta_path.exists():
                    logger.info("Subiendo metadata a la raiz...")
                    await loop.run_in_executor(None, subir_transcripcion, meta_path, folder_id)
            logger.info("Transcripcion subida: %s", drive_url_txt)

            video.drive_url = drive_url_video or drive_url_txt
            await session.commit()

            def _cleanup():
                for f in [mp4_path, audio_path, txt_path, meta_path]:
                    if f:
                        f.unlink(missing_ok=True)

            await loop.run_in_executor(None, _cleanup)
            logger.info("Archivos temporales eliminados")

            return {
                "status": "ok",
                "video_id": video_id,
                "drive_url_video": drive_url_video,
                "drive_url_txt": drive_url_txt,
            }

        except Exception as exc:
            if isinstance(exc, StaleDataError):
                logger.warning("Video %s ya fue eliminado, saltando subida a Drive", video_id)
                await session.rollback()
                return {"status": "saltado", "motivo": "video eliminado"}
            await session.rollback()
            video = await session.get(Video, video_id)
            logger.error("Error subiendo a Drive video %s: %s", video_id, exc)
            exc_type = type(exc).__name__
            exc_str = str(exc).lower()
            is_auth_error = any(k in exc_str for k in ("credentials", "refresh", "unauthorized", "auth"))
            is_quota_error = any(k in exc_str for k in ("storagequota", "quota", "rate limit", "limit"))
            if is_auth_error or is_quota_error:
                logger.warning("No se pudo subir a Drive (%s). El video queda aprobado.", "credenciales" if is_auth_error else "cuota")

                def _cleanup_error():
                    for f in tmp_dir.glob(f"{video_id}.*"):
                        f.unlink(missing_ok=True)

                await loop.run_in_executor(None, _cleanup_error)
                if video:
                    video.drive_url = "pending_drive_setup"
                    try:
                        await session.commit()
                    except StaleDataError:
                        logger.warning("Video %s ya no existe en DB", video_id)
                return {"status": "ok", "video_id": video_id, "drive_url": None}
            if attempt >= max_retries:
                if video:
                    video.status = "error"
                    await session.commit()
                logger.error("Video %s marcado como 'error' tras %d intentos fallidos", video_id, max_retries + 1)
            else:
                logger.info("Reintentando subida a Drive para video %s en 30s...", video_id)
                await asyncio.sleep(30)

        finally:
            await session.close()
