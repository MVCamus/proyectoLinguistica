import logging
import shutil
import subprocess
from pathlib import Path

import requests
import yt_dlp

logger = logging.getLogger("maite.downloader")


def descargar_audio(
    url: str,
    video_id: str,
    tmp_dir: Path,
    cookies_file: Path | None = None,
) -> Path:
    """Descarga el video mp4 + extrae audio mp3.
    Retorna la ruta del mp3 (para Whisper). El mp4 queda al lado para el frontend."""
    if url.startswith("file://"):
        return _procesar_archivo_local(url, video_id, tmp_dir)

    if _es_url_directa(url):
        return _descargar_desde_cdn(url, video_id, tmp_dir)

    return _descargar_con_ytdlp(url, video_id, tmp_dir, cookies_file)


def _procesar_archivo_local(url: str, video_id: str, tmp_dir: Path) -> Path:
    video_path = Path(url.replace("file://", ""))
    mp4_path = tmp_dir / f"{video_id}.mp4"
    mp3_path = tmp_dir / f"{video_id}.mp3"

    # Mover el archivo original a mp4
    if not mp4_path.exists():
        shutil.move(str(video_path), str(mp4_path))
        logger.info("Archivo local movido a: %s", mp4_path)

    if not mp3_path.exists():
        logger.info("Extrayendo audio mp3 de %s...", mp4_path)
        subprocess.run(
            ["ffmpeg", "-i", str(mp4_path), "-vn", "-acodec", "libmp3lame",
             "-q:a", "2", "-y", str(mp3_path)],
            capture_output=True, check=True,
        )
        logger.info("Audio extraido: %s", mp3_path)

    return mp3_path


def _es_url_directa(url: str) -> bool:
    if ".tiktok.com" not in url and "tiktokcdn" not in url:
        return False
    if any(ext in url for ext in (".mp4", ".m4a", ".webm")):
        return True
    import re
    if re.search(r'v\d+[-.](?:webapp|cdn|prime)', url):
        return True
    return False


def _descargar_desde_cdn(url: str, video_id: str, tmp_dir: Path) -> Path:
    mp4_path = tmp_dir / f"{video_id}.mp4"
    mp3_path = tmp_dir / f"{video_id}.mp3"

    if not mp4_path.exists():
        logger.info("Descargando video desde CDN: %s", url[:100])
        r = requests.get(url, timeout=60, stream=True)
        r.raise_for_status()
        with open(mp4_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)
        logger.info("Video descargado: %s (%.1f MB)", mp4_path, mp4_path.stat().st_size / 1024 / 1024)

    if not mp3_path.exists():
        logger.info("Extrayendo audio mp3 del video...")
        subprocess.run(
            ["ffmpeg", "-i", str(mp4_path), "-vn", "-acodec", "libmp3lame",
             "-q:a", "2", "-y", str(mp3_path)],
            capture_output=True, check=True,
        )
        logger.info("Audio extraido: %s", mp3_path)

    # NO borramos el mp4 — lo necesita el frontend
    return mp3_path


def _descargar_con_ytdlp(
    url: str,
    video_id: str,
    tmp_dir: Path,
    cookies_file: Path | None,
) -> Path:
    try:
        return _ytdlp_descargar(url, video_id, tmp_dir, cookies_file)
    except Exception as e:
        logger.warning("Error con cookies, reintentando sin cookies: %s", e)
        if cookies_file:
            return _ytdlp_descargar(url, video_id, tmp_dir, None)
        raise


def _ytdlp_descargar(
    url: str,
    video_id: str,
    tmp_dir: Path,
    cookies_file: Path | None,
) -> Path:
    opts: dict = {
        "format": "best[ext=mp4]/best",
        "outtmpl": str(tmp_dir / "%(id)s.%(ext)s"),
        "quiet": True,
        "no_warnings": True,
        "extract_flat": False,
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": "192",
        }],
        "keepvideo": True,
    }
    if cookies_file and cookies_file.exists():
        opts["cookiefile"] = str(cookies_file)
        logger.info("Usando cookies: %s", cookies_file)

    logger.info("Ejecutando yt-dlp en: %s", url[:120])
    with yt_dlp.YoutubeDL(opts) as ydl:
        ydl.download([url])

    mp4_path = tmp_dir / f"{video_id}.mp4"
    mp3_path = tmp_dir / f"{video_id}.mp3"

    if not mp4_path.exists():
        for f in tmp_dir.glob(f"{video_id}.*"):
            if f.suffix in (".mp4", ".webm", ".mkv"):
                mp4_path = f
                break
        else:
            logger.warning("No se encontro archivo de video tras descarga")
    else:
        logger.info("Video descargado: %s (%.1f MB)", mp4_path, mp4_path.stat().st_size / 1024 / 1024)

    if not mp3_path.exists():
        for f in tmp_dir.glob(f"{video_id}.*"):
            if f.suffix == ".mp3":
                mp3_path = f
                break
        else:
            raise FileNotFoundError(f"Audio mp3 no encontrado tras descarga: {mp3_path}")
    logger.info("Audio mp3 extraido: %s", mp3_path)

    return mp3_path
