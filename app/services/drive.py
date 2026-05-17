import logging
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2 import service_account
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

logger = logging.getLogger("maite.drive")

SCOPES = ["https://www.googleapis.com/auth/drive.file"]
BASE_DIR = Path(__file__).resolve().parent.parent.parent
SERVICE_ACCOUNT_FILE = BASE_DIR / "credentials" / "gdrive_service_account.json"
OAUTH_TOKEN_FILE = BASE_DIR / "credentials" / "gdrive_credentials.json"


def _get_service():
    if SERVICE_ACCOUNT_FILE.exists():
        creds = service_account.Credentials.from_service_account_file(
            str(SERVICE_ACCOUNT_FILE), scopes=SCOPES
        )
        return build("drive", "v3", credentials=creds)

    if OAUTH_TOKEN_FILE.exists():
        creds = Credentials.from_authorized_user_file(str(OAUTH_TOKEN_FILE), SCOPES)
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
        return build("drive", "v3", credentials=creds)

    raise FileNotFoundError(
        "No hay credenciales de Drive. "
        "Crea credentials/gdrive_service_account.json (service account) "
        "o ejecuta: python setup_drive.py (OAuth)"
    )


def _crear_subcarpeta(service, nombre: str, parent_id: str) -> str:
    file = (
        service.files()
        .create(
            body={
                "name": nombre,
                "mimeType": "application/vnd.google-apps.folder",
                "parents": [parent_id],
            },
            fields="id",
        )
        .execute()
    )
    return file.get("id")


def subir_audio(audio_path: Path, folder_id: str) -> str:
    service = _get_service()
    media = MediaFileUpload(str(audio_path), mimetype="audio/mpeg")
    file = (
        service.files()
        .create(
            media_body=media,
            body={"name": audio_path.name, "parents": [folder_id]},
            fields="id, webViewLink",
        )
        .execute()
    )
    return file.get("webViewLink")


def subir_transcripcion(txt_path: Path, folder_id: str) -> str:
    service = _get_service()
    media = MediaFileUpload(str(txt_path), mimetype="text/plain")
    file = (
        service.files()
        .create(
            media_body=media,
            body={"name": txt_path.name, "parents": [folder_id]},
            fields="id, webViewLink",
        )
        .execute()
    )
    return file.get("webViewLink")


def subir_video(video_path: Path, video_id: str, parent_folder_id: str, folder_name: str | None = None) -> str:
    service = _get_service()
    folder_name = folder_name or f"video_{video_id}"
    carpeta_id = _crear_subcarpeta(service, folder_name, parent_folder_id)
    media = MediaFileUpload(str(video_path), mimetype="video/mp4")
    file = (
        service.files()
        .create(
            media_body=media,
            body={"name": f"{video_id}.mp4", "parents": [carpeta_id]},
            fields="id, webViewLink",
        )
        .execute()
    )
    return file.get("webViewLink")


def subir_txt_en_carpeta(txt_path: Path, video_id: str, parent_folder_id: str, folder_name: str | None = None, file_name: str | None = None) -> str:
    """Busca la subcarpeta del video y sube el archivo adentro."""
    folder_name = folder_name or f"video_{video_id}"
    file_name = file_name or f"{video_id}.txt"
    service = _get_service()
    results = (
        service.files()
        .list(
            q=f"name='{folder_name}' and '{parent_folder_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
            fields="files(id)",
            pageSize=1,
        )
        .execute()
    )
    items = results.get("files", [])
    if not items:
        logger.warning("No se encontro la carpeta %s en Drive", folder_name)
        return ""
    carpeta_id = items[0]["id"]
    media = MediaFileUpload(str(txt_path), mimetype="text/plain")
    file = (
        service.files()
        .create(
            media_body=media,
            body={"name": file_name, "parents": [carpeta_id]},
            fields="id, webViewLink",
        )
        .execute()
    )
    return file.get("webViewLink")


def renombrar_carpeta(video_id: str, parent_folder_id: str, old_name: str, new_name: str) -> bool:
    """Renombra una carpeta en Drive."""
    try:
        service = _get_service()
        results = (
            service.files()
            .list(
                q=f"name='{old_name}' and '{parent_folder_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
                fields="files(id)",
                pageSize=1,
            )
            .execute()
        )
        items = results.get("files", [])
        if items:
            file_id = items[0]["id"]
            service.files().update(fileId=file_id, body={"name": new_name}).execute()
            logger.info("Carpeta '%s' renombrada a '%s'", old_name, new_name)
            return True
        logger.info("Carpeta '%s' no encontrada en Drive", old_name)
        return False
    except Exception as e:
        logger.warning("Error renombrando carpeta en Drive: %s", e)
        return False


def eliminar_carpeta_video(video_id: str, parent_folder_id: str, folder_name: str | None = None) -> bool:
    """Busca y elimina la carpeta del video de Drive."""
    folder_name = folder_name or f"video_{video_id}"
    try:
        service = _get_service()
        results = (
            service.files()
            .list(
                q=f"name='{folder_name}' and '{parent_folder_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
                fields="files(id)",
                pageSize=1,
            )
            .execute()
        )
        items = results.get("files", [])
        if items:
            service.files().delete(fileId=items[0]["id"]).execute()
            logger.info("Carpeta %s eliminada de Drive", folder_name)
            return True
        logger.info("Carpeta %s no encontrada en Drive", folder_name)
        return False
    except Exception as e:
        logger.warning("Error eliminando carpeta de Drive: %s", e)
        return False
