import re
from pydantic import field_validator
from pydantic_settings import BaseSettings
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    database_url: str = ""

    corpus_target: int = 400
    pool_size: int = 1500
    triage_block_size: int = 20

    whisper_model: str = "medium"
    whisper_cpu_threads: int = 4
    whisper_language: str = "es"

    tmp_audio_dir: str = str(BASE_DIR / "tmp" / "harvester")
    log_file: str = str(BASE_DIR / "logs" / "harvester.log")

    google_drive_folder_id: str = ""
    default_hashtags: list[str] = ["noticias", "aprendeentiktok", "español"]

    @field_validator("database_url", mode="after")
    @classmethod
    def clean_database_url(cls, v: str) -> str:
        if not v:
            return ""
        v = v.strip()
        if v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql+asyncpg://", 1)
        if v.startswith("postgresql://") and not v.startswith("postgresql+"):
            return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    @field_validator("google_drive_folder_id", mode="after")
    @classmethod
    def clean_drive_folder_id(cls, v: str) -> str:
        if not v:
            return ""
        v = v.strip()
        match = re.search(r"folders/([a-zA-Z0-9_-]+)", v)
        if match:
            return match.group(1)
        return v.split("?")[0].split("#")[0].strip()

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def tmp_dir(self) -> Path:
        return Path(self.tmp_audio_dir)


settings = Settings()
