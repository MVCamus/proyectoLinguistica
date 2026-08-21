import logging
import shutil
import subprocess
from pathlib import Path

import requests
import yt_dlp

logger = logging.getLogger("tiktok_scraping.downloader")


def _descargar_via_tikwm(url: str, video_id: str, tmp_dir: Path) -> Path | None:
    logger.info("Intentando descargar video a través de TikWM API para: %s", url)
    try:
        r = requests.post("https://www.tikwm.com/api/", data={"url": url}, timeout=15)
        if r.status_code == 200:
            data = r.json()
            if data.get("code") == 0 and "data" in data:
                play_url = data["data"].get("play") or data["data"].get("wmplay")
                if play_url:
                    logger.info("URL directa obtenida de TikWM: %s", play_url[:100])
                    return _descargar_desde_cdn(play_url, video_id, tmp_dir)
            logger.warning("TikWM API respondió con error: %s", data.get("msg"))
    except Exception as e:
        logger.warning("Error descargando con TikWM API: %s", e)
    return None


def _descargar_via_lovetik(url: str, video_id: str, tmp_dir: Path) -> Path | None:
    logger.info("Intentando descargar video a través de Lovetik API para: %s", url)
    try:
        r = requests.post("https://lovetik.com/api/ajax/search", data={"query": url}, timeout=15)
        if r.status_code == 200:
            data = r.json()
            if data.get("status") == "ok" and data.get("links"):
                play_url = None
                for link in data["links"]:
                    if link.get("t") == "MP4" or "mp4" in str(link.get("t")).lower():
                        play_url = link.get("a")
                        break
                if not play_url and data["links"]:
                    play_url = data["links"][0].get("a")

                if play_url:
                    logger.info("URL directa obtenida de Lovetik: %s", play_url[:100])
                    return _descargar_desde_cdn(play_url, video_id, tmp_dir)
            logger.warning("Lovetik API respondió con error o sin links: %s", data.get("mess"))
    except Exception as e:
        logger.warning("Error descargando con Lovetik API: %s", e)
    return None


def descargar_audio(
    url: str,
    video_id: str,
    tmp_dir: Path,
    cookies_file: Path | None = None,
) -> Path:
    if url.startswith("file://"):
        return _procesar_archivo_local(url, video_id, tmp_dir)

    if not url.startswith("file://"):
        url = url.split("?")[0].split("#")[0]

    if _es_url_directa(url):
        return _descargar_desde_cdn(url, video_id, tmp_dir)

    mp3_path = _descargar_via_tikwm(url, video_id, tmp_dir)
    if mp3_path and mp3_path.exists():
        return mp3_path

    mp3_path = _descargar_via_lovetik(url, video_id, tmp_dir)
    if mp3_path and mp3_path.exists():
        return mp3_path

    return ytdlp_reintentar(url, video_id, tmp_dir, cookies_file)



def _procesar_archivo_local(url: str, video_id: str, tmp_dir: Path) -> Path:
    video_path = Path(url.replace("file://", ""))
    mp4_path = tmp_dir / f"{video_id}.mp4"
    mp3_path = tmp_dir / f"{video_id}.mp3"

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
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        }
        r = requests.get(url, timeout=60, stream=True, headers=headers)
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

    return mp3_path


def _descargar_solo_video(
    url: str,
    video_id: str,
    tmp_dir: Path,
    cookies_file: Path | None,
) -> Path:
    opts: dict = {
        "format": "bestvideo+bestaudio/best",
        "outtmpl": str(tmp_dir / "%(id)s.%(ext)s"),
        "merge_output_format": "mp4",
        "quiet": True,
        "no_warnings": True,
        "extract_flat": False,
        "http_headers": {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
            "Referer": "https://www.tiktok.com/",
        },
    }
    if cookies_file and cookies_file.exists():
        opts["cookiefile"] = str(cookies_file)
        logger.info("Usando cookies: %s", cookies_file)

    logger.info("Ejecutando yt-dlp en: %s", url[:120])
    with yt_dlp.YoutubeDL(opts) as ydl:
        success = ydl.download([url])
        if success != 0:
            raise RuntimeError(f"yt-dlp falló con código {success} para la URL: {url[:120]}")

    mp4_path = tmp_dir / f"{video_id}.mp4"
    if not mp4_path.exists():
        for f in tmp_dir.glob(f"{video_id}.*"):
            if f.suffix in (".mp4", ".webm", ".mkv") and f.stat().st_size > 1024:
                mp4_path = f
                break
        else:
            raise FileNotFoundError(f"Video mp4 no encontrado tras descarga: {video_id}")
    logger.info("Video descargado: %s (%.1f MB)", mp4_path.name, mp4_path.stat().st_size / 1024 / 1024)
    return mp4_path


def _extraer_audio(video_path: Path, audio_path: Path) -> Path:
    if audio_path.exists():
        logger.info("Audio ya existe: %s", audio_path)
        return audio_path

    intentos = [
        ("mp3 (libmp3lame)", ["ffmpeg", "-i", str(video_path), "-vn", "-acodec", "libmp3lame",
                               "-q:a", "2", "-y", str(audio_path)]),
        ("aac",              ["ffmpeg", "-i", str(video_path), "-vn", "-c:a", "aac",
                               "-b:a", "128k", "-y", str(audio_path.with_suffix(".aac"))]),
        ("mp3 estricto",     ["ffmpeg", "-i", str(video_path), "-vn", "-acodec", "libmp3lame",
                               "-q:a", "2", "-strict", "-2", "-y", str(audio_path)]),
    ]

    ultimo_error = ""
    for nombre, cmd in intentos:
        try:
            logger.info("Extrayendo audio (%s): %s -> ...", nombre, video_path.name)
            result = subprocess.run(cmd, capture_output=True, timeout=120, check=False)
            if result.returncode == 0:
                salida = Path(cmd[-1])
                if salida.suffix == ".aac":
                    salida.rename(audio_path)
                if audio_path.exists():
                    logger.info("Audio extraido (%s): %s (%.1f MB)", nombre,
                                audio_path.name, audio_path.stat().st_size / 1024 / 1024)
                    return audio_path
                break
            stderr_txt = result.stderr.decode("utf-8", errors="replace")[-500:]
            ultimo_error = f"codigo {result.returncode}: {stderr_txt}"
            logger.warning("  ffmpeg %s fallo: %s", nombre, ultimo_error)
        except Exception as e:
            ultimo_error = str(e)
            logger.warning("  ffmpeg %s exception: %s", nombre, e)

    raise RuntimeError(f"No se pudo extraer audio de {video_path.name}. Ultimo error: {ultimo_error}")


def _ytdlp_descargar(
    url: str,
    video_id: str,
    tmp_dir: Path,
    cookies_file: Path | None,
) -> Path:
    mp4_path = _descargar_solo_video(url, video_id, tmp_dir, cookies_file)
    audio_path = _extraer_audio(mp4_path, tmp_dir / f"{video_id}.mp3")
    return audio_path


def ytdlp_reintentar(
    url: str,
    video_id: str,
    tmp_dir: Path,
    cookies_file: Path | None,
) -> Path:
    try:
        return _ytdlp_descargar(url, video_id, tmp_dir, cookies_file)
    except Exception as e:
        err_str = str(e).lower()
        if cookies_file and ("cookie" in err_str or "403" in err_str or "signature" in err_str):
            logger.warning("Posible error de cookies, reintentando sin cookies: %s", e)
            return _ytdlp_descargar(url, video_id, tmp_dir, None)
        raise
