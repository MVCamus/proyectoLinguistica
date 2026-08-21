import logging
import re
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2 import service_account
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

logger = logging.getLogger("tiktok_scraping.drive")

SCOPES = ["https://www.googleapis.com/auth/drive.file"]


def _escape_q(val: str) -> str:
    return val.replace("\\", "\\\\").replace("'", "\\'")
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
        if creds.expired:
            if not creds.refresh_token:
                raise RuntimeError(
                    "Credenciales de Drive expiradas sin refresh_token. "
                    "Elimina credentials/gdrive_credentials.json y vuelve a ejecutar: python setup_drive.py"
                )
            creds.refresh(Request())
        return build("drive", "v3", credentials=creds)

def existe_client_id() -> bool:
    return (BASE_DIR / "credentials" / "gdrive_client_id.json").exists() or (BASE_DIR / "gdrive_client_id.json").exists()


def obtener_info_usuario() -> dict:
    has_client = existe_client_id()
    try:
        service = _get_service()
        about = service.about().get(fields="user(emailAddress,displayName)").execute()
        user = about.get("user", {})
        return {
            "connected": True,
            "email": user.get("emailAddress"),
            "display_name": user.get("displayName"),
            "has_client_id": has_client,
        }
    except Exception as e:
        logger.debug("Drive no conectado: %s", e)
        return {
            "connected": False,
            "email": None,
            "display_name": None,
            "has_client_id": has_client,
        }


def desconectar_drive() -> bool:
    eliminado = False
    if OAUTH_TOKEN_FILE.exists():
        try:
            OAUTH_TOKEN_FILE.unlink()
            eliminado = True
        except Exception:
            pass
    if SERVICE_ACCOUNT_FILE.exists():
        try:
            SERVICE_ACCOUNT_FILE.unlink()
            eliminado = True
        except Exception:
            pass
    return eliminado


def sanitizar_folder_id(url_o_id: str) -> str:
    if not url_o_id:
        return ""
    url_o_id = url_o_id.strip()
    match = re.search(r"folders/([a-zA-Z0-9_-]+)", url_o_id)
    if match:
        return match.group(1)
    return url_o_id.split("?")[0].split("#")[0].strip()


def guardar_client_secrets_json(content: str | dict):
    CREDENTIALS_DIR = BASE_DIR / "credentials"
    CREDENTIALS_DIR.mkdir(parents=True, exist_ok=True)
    target_file = CREDENTIALS_DIR / "gdrive_client_id.json"
    with open(target_file, "w", encoding="utf-8") as f:
        if isinstance(content, dict):
            import json
            json.dump(content, f, indent=2)
        else:
            f.write(content)
    return target_file


def crear_client_secrets_desde_claves(client_id: str, client_secret: str):
    client_id = client_id.strip()
    client_secret = client_secret.strip()
    data = {
        "installed": {
            "client_id": client_id,
            "project_id": "google-drive-integration",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_secret": client_secret,
            "redirect_uris": ["http://localhost"]
        }
    }
    return guardar_client_secrets_json(data)


def ejecutar_oauth_flow(client_file: Path | None = None):
    import webbrowser
    from google_auth_oauthlib.flow import InstalledAppFlow
    if not client_file or not client_file.exists():
        client_file = BASE_DIR / "credentials" / "gdrive_client_id.json"
        if not client_file.exists():
            client_file = BASE_DIR / "gdrive_client_id.json"
    if not client_file.exists():
        raise FileNotFoundError("No se encontró el archivo gdrive_client_id.json en credentials/")
    
    flow = InstalledAppFlow.from_client_secrets_file(str(client_file), SCOPES)
    creds = flow.run_local_server(
        port=0,
        prompt="consent",
        access_type="offline",
        open_browser=True
    )
    
    (BASE_DIR / "credentials").mkdir(parents=True, exist_ok=True)
    with open(OAUTH_TOKEN_FILE, "w", encoding="utf-8") as f:
        f.write(creds.to_json())
        
    return obtener_info_usuario()


def _group_folder_name(corpus_number: int) -> str:
    start = ((corpus_number - 1) // 100) * 100 + 1
    end = start + 99
    return f"videos {start} - {end}"


def obtener_carpeta_grupo(corpus_number: int, root_folder_id: str) -> str:
    if corpus_number is None:
        return root_folder_id
    service = _get_service()
    group_name = _group_folder_name(corpus_number)
    results = (
            service.files()
            .list(
                q=f"name='{_escape_q(group_name)}' and '{root_folder_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
            fields="files(id)",
            pageSize=1,
        )
        .execute()
    )
    items = results.get("files", [])
    if items:
        return items[0]["id"]
    return _crear_subcarpeta(service, group_name, root_folder_id)


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


def _buscar_o_crear_carpeta(service, folder_name: str, parent_folder_id: str) -> str:
    results = (
        service.files()
        .list(
            q=f"name='{_escape_q(folder_name)}' and '{parent_folder_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
            fields="files(id)",
            pageSize=1,
        )
        .execute()
    )
    items = results.get("files", [])
    if items:
        return items[0]["id"]
    return _crear_subcarpeta(service, folder_name, parent_folder_id)


def subir_video(video_path: Path, video_id: str, parent_folder_id: str, folder_name: str | None = None) -> str:
    service = _get_service()
    folder_name = folder_name or f"video_{video_id}"
    carpeta_id = _buscar_o_crear_carpeta(service, folder_name, parent_folder_id)
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
    folder_name = folder_name or f"video_{video_id}"
    file_name = file_name or f"{video_id}.txt"
    service = _get_service()
    results = (
        service.files()
        .list(
            q=f"name='{_escape_q(folder_name)}' and '{parent_folder_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
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
    try:
        service = _get_service()
        corpus_number = None
        if old_name and old_name[0].isdigit():
            try:
                corpus_number = int(old_name.split("_")[0])
            except (ValueError, IndexError):
                pass

        group_ids = []
        if corpus_number and parent_folder_id:
            group_id = _obtener_carpeta_grupo_por_nombre(service, corpus_number, parent_folder_id)
            if group_id:
                group_ids.append(group_id)

        if not group_ids and parent_folder_id:
            group_ids.append(parent_folder_id)

        renombradas = 0
        for gid in group_ids:
            page_token = None
            while True:
                results = (
                    service.files()
                    .list(
                        q=f"name='{_escape_q(old_name)}' and '{gid}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
                        fields="nextPageToken, files(id)",
                        pageSize=50,
                        pageToken=page_token,
                    )
                    .execute()
                )
                items = results.get("files", [])
                for item in items:
                    service.files().update(fileId=item["id"], body={"name": new_name}).execute()
                    renombradas += 1
                page_token = results.get("nextPageToken")
                if not page_token:
                    break
        if renombradas:
            logger.info("%d carpeta(s) '%s' renombrada(s) a '%s'", renombradas, old_name, new_name)
            return True
        logger.info("Carpeta '%s' no encontrada en Drive", old_name)
        return False
    except Exception as e:
        logger.warning("Error renombrando carpeta en Drive: %s", e)
        return False


def _eliminar_permanentemente(service, file_id: str, desc: str) -> bool:
    try:
        service.files().delete(fileId=file_id).execute()
        logger.info("%s (%s) eliminado permanentemente", desc, file_id)
        return True
    except Exception as e:
        logger.warning("No se pudo eliminar %s (%s): %s", desc, file_id, e)
        return False


def _obtener_carpeta_grupo_por_nombre(service, corpus_number: int, root_folder_id: str) -> str | None:
    group_name = _group_folder_name(corpus_number)
    results = (
        service.files()
        .list(
            q=f"name='{_escape_q(group_name)}' and '{root_folder_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
            fields="files(id)",
            pageSize=1,
        )
        .execute()
    )
    items = results.get("files", [])
    return items[0]["id"] if items else None


def mover_carpeta_a_grupo(folder_id: str, new_corpus_number: int, root_folder_id: str) -> bool:
    import re
    try:
        service = _get_service()
        folder = service.files().get(fileId=folder_id, fields="parents").execute()
        current_parents = folder.get("parents", [])

        target_group = _group_folder_name(new_corpus_number)

        group_id = _obtener_carpeta_grupo_por_nombre(service, new_corpus_number, root_folder_id)
        if not group_id:
            group_id = _crear_subcarpeta(service, target_group, root_folder_id)

        if group_id in current_parents:
            return True

        for parent_id in current_parents:
            if parent_id != group_id:
                service.files().update(fileId=folder_id, removeParents=parent_id).execute()

        service.files().update(fileId=folder_id, addParents=group_id).execute()
        logger.info("Carpeta %s movida al grupo %s", folder_id, target_group)
        return True
    except Exception as e:
        logger.warning("Error moviendo carpeta %s al grupo %s: %s", folder_id, _group_folder_name(new_corpus_number), e)
        return False


def listar_carpetas_video_en_drive(parent_folder_id: str) -> list[dict]:
    import re
    service = _get_service()
    folders = []

    page_token = None
    while True:
        results = (
            service.files()
            .list(
                q=f"'{parent_folder_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
                fields="nextPageToken, files(id, name)",
                pageSize=100,
                pageToken=page_token,
            )
            .execute()
        )
        for gf in results.get("files", []):
            if not re.match(r"^videos \d+ - \d+$", gf["name"]):
                continue
            sub_token = None
            while True:
                sub = (
                    service.files()
                    .list(
                        q=f"'{gf['id']}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
                        fields="nextPageToken, files(id, name)",
                        pageSize=100,
                        pageToken=sub_token,
                    )
                    .execute()
                )
                for vf in sub.get("files", []):
                    if re.match(r"^\d{3}_", vf["name"]):
                        folders.append(vf)
                sub_token = sub.get("nextPageToken")
                if not sub_token:
                    break
        page_token = results.get("nextPageToken")
        if not page_token:
            break

    return folders


def eliminar_carpeta_video(video_id: str, parent_folder_id: str, folder_name: str | None = None) -> bool:
    folder_name = folder_name or f"video_{video_id}"
    eliminadas = 0
    try:
        service = _get_service()

        corpus_number = None
        if folder_name and folder_name[0].isdigit():
            try:
                corpus_number = int(folder_name.split("_")[0])
            except (ValueError, IndexError):
                pass

        carpetas = []

        if corpus_number and parent_folder_id:
            group_id = _obtener_carpeta_grupo_por_nombre(service, corpus_number, parent_folder_id)
            if group_id:
                logger.info("Buscando carpeta '%s' dentro del grupo '%s'...", folder_name, _group_folder_name(corpus_number))
                results = (
                    service.files()
                    .list(
                        q=f"name='{_escape_q(folder_name)}' and '{group_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
                        fields="files(id, name)",
                        pageSize=1,
                    )
                    .execute()
                )
                carpetas.extend(results.get("files", []))

        if not carpetas:
            logger.info("Buscando carpeta '%s' en todo el Drive...", folder_name)
            page_token = None
            while True:
                results = (
                    service.files()
                    .list(
                        q=f"name='{_escape_q(folder_name)}' and mimeType='application/vnd.google-apps.folder' and trashed=false",
                        fields="nextPageToken, files(id, name)",
                        pageSize=50,
                        pageToken=page_token,
                    )
                    .execute()
                )
                carpetas.extend(results.get("files", []))
                page_token = results.get("nextPageToken")
                if not page_token:
                    break

        for carpeta in carpetas:
            fid = carpeta["id"]
            hijo_token = None
            while True:
                hijos = (
                    service.files()
                    .list(
                        q=f"'{fid}' in parents and trashed=false",
                        fields="nextPageToken, files(id, name)",
                        pageSize=100,
                        pageToken=hijo_token,
                    )
                    .execute()
                )
                for hijo in hijos.get("files", []):
                    _eliminar_permanentemente(service, hijo["id"], f"Hijo '{hijo['name']}'")
                hijo_token = hijos.get("nextPageToken")
                if not hijo_token:
                    break
            if _eliminar_permanentemente(service, fid, f"Carpeta '{carpeta['name']}'"):
                eliminadas += 1

        if not eliminadas:
            logger.info("Buscando archivos sueltos del video %s en Drive...", video_id)
            for patron in [f"{video_id}.mp4", f"{video_id}.txt", f"{video_id}_metadata.txt"]:
                page_token = None
                while True:
                    results = (
                        service.files()
                        .list(
                            q=f"name='{_escape_q(patron)}' and trashed=false",
                            fields="nextPageToken, files(id, name)",
                            pageSize=50,
                            pageToken=page_token,
                        )
                        .execute()
                    )
                    for archivo in results.get("files", []):
                        if _eliminar_permanentemente(service, archivo["id"], f"Archivo '{archivo['name']}'"):
                            eliminadas += 1
                    page_token = results.get("nextPageToken")
                    if not page_token:
                        break

        if eliminadas:
            logger.info("%d elemento(s) de '%s' eliminado(s) permanentemente de Drive", eliminadas, folder_name)
            return True
        logger.warning("No se encontraron elementos de '%s' en Drive", folder_name)
        return False
    except Exception as e:
        logger.error("Error eliminando de Drive '%s': %s", folder_name, e)
        return False
