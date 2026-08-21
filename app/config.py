import re
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

import shutil

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BASE_DIR / ".env"
EXAMPLE_ENV = BASE_DIR / ".env.example"

if not ENV_FILE.exists():
    if EXAMPLE_ENV.exists():
        try:
            shutil.copy(EXAMPLE_ENV, ENV_FILE)
        except Exception:
            pass
    else:
        try:
            with open(ENV_FILE, "w", encoding="utf-8") as f:
                f.write("DATABASE_URL=\nGOOGLE_DRIVE_FOLDER_ID=\nWHISPER_MODEL=medium\n")
        except Exception:
            pass


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore", env_file=".env", env_file_encoding="utf-8")

    database_url: str = ""
    google_drive_folder_id: str = ""
    corpus_target: int = 400

    whisper_model: str = "medium"
    whisper_cpu_threads: int = 4
    whisper_language: str = "es"

    tmp_audio_dir: str = str(BASE_DIR / "tmp" / "harvester")
    log_file: str = str(BASE_DIR / "logs" / "harvester.log")

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

    @property
    def tmp_dir(self) -> Path:
        return Path(self.tmp_audio_dir)


settings = Settings()
