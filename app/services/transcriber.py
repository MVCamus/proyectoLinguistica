import logging
from pathlib import Path

from faster_whisper import WhisperModel

from app.config import settings as s

logger = logging.getLogger("maite.transcriber")

_model: WhisperModel | None = None


def get_model() -> WhisperModel:
    global _model
    if _model is None:
        cpu_threads = s.whisper_cpu_threads
        model_name = s.whisper_model
        logger.info("Cargando modelo Whisper '%s' en CPU (%d threads)...", model_name, cpu_threads)
        _model = WhisperModel(
            model_name,
            device="cpu",
            cpu_threads=cpu_threads,
            compute_type="int8",
        )
        logger.info("Modelo Whisper cargado")
    return _model


def transcribir(audio_path: Path, language: str = "es", video_id: str = "") -> list[dict]:
    logger.info("Transcribiendo %s (idioma=%s)...", audio_path, language)
    model = get_model()
    segments, info = model.transcribe(str(audio_path), language=language, vad_filter=True)
    logger.info("Duracion audio: %.2f seg, idioma detectado: %s", info.duration, info.language)
    resultado = [
        {"start": round(s.start, 2), "end": round(s.end, 2), "text": s.text.strip()}
        for s in segments
    ]
    logger.info("Transcripcion generada: %d segmentos", len(resultado))
    return resultado