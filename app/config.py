from pydantic_settings import BaseSettings
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    database_url: str = f"sqlite+aiosqlite:///{(BASE_DIR / 'corpus.db').as_posix()}"

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

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def tmp_dir(self) -> Path:
        return Path(self.tmp_audio_dir)


settings = Settings()
