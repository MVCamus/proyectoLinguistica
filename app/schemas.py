from datetime import datetime

from pydantic import BaseModel


class TranscriptSegment(BaseModel):
    start: float
    end: float
    text: str


class IngestaRequest(BaseModel):
    hashtags_incluir: list[str] = []
    hashtags_excluir: list[str] = []
    urls_manuales: list[str] | None = None


class IngestaResponse(BaseModel):
    total_candidatos: int
    mensaje: str


class VideoOut(BaseModel):
    id: str
    url: str
    username: str | None
    description: str | None
    hashtags: list[str] | None
    duration_sec: int | None
    status: str
    transcript_original: list[TranscriptSegment] | None
    transcript_editada: list[TranscriptSegment] | None
    drive_url: str | None
    corpus_number: int | None
    shuffle_order: int | None
    created_at: datetime
    approved_at: datetime | None

    model_config = {"from_attributes": True}


class VideoListResponse(BaseModel):
    videos: list[VideoOut]
    total: int


class AprobarRequest(BaseModel):
    transcript_editada: list[TranscriptSegment]


class MensajeResponse(BaseModel):
    mensaje: str
