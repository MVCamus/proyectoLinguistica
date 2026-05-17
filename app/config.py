from pydantic_settings import BaseSettings
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    database_url: str = f"sqlite+aiosqlite:///{(BASE_DIR / 'corpus.db').as_posix()}"

    corpus_target: int = 400
    pool_size: int = 1500
    triage_block_size: int = 20
    pretranscribe_window: int = 60

    whisper_model: str = "medium"
    whisper_cpu_threads: int = 4
    whisper_language: str = "es"

    tmp_audio_dir: str = str(BASE_DIR / "tmp" / "harvester")
    log_file: str = str(BASE_DIR / "logs" / "harvester.log")

    google_drive_credentials_path: str = "credentials/gdrive_credentials.json"
    google_drive_folder_id: str = "1w8ZyD9HQOyedfLpW3DOrYwN_GcNSSy8r"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def tmp_dir(self) -> Path:
        return Path(self.tmp_audio_dir)


settings = Settings()
