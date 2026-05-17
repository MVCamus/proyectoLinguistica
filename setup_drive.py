"""
Script para configurar credenciales de Google Drive.

1. Ve a https://console.cloud.google.com/
2. Crea un proyecto o usa uno existente
3. Habilita "Google Drive API"
4. Ve a "Credenciales" → "Crear credenciales" → "ID de cliente OAuth"
5. Elige "Aplicación de escritorio"
6. Descarga el JSON y guardalo como: credentials/gdrive_client_id.json

Luego ejecuta:

    python setup_drive.py

Te abrira el navegador para que inicies sesion con tu cuenta de Google.
Al autorizar, se guardara el token en credentials/gdrive_credentials.json
"""

import json
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ["https://www.googleapis.com/auth/drive.file"]
CREDENTIALS_DIR = Path("credentials")
CLIENT_FILE = CREDENTIALS_DIR / "gdrive_client_id.json"
TOKEN_FILE = CREDENTIALS_DIR / "gdrive_credentials.json"


def main():
    CREDENTIALS_DIR.mkdir(parents=True, exist_ok=True)

    if not CLIENT_FILE.exists():
        print(f"ERROR: No se encuentra {CLIENT_FILE}")
        print("Sigue las instrucciones al inicio de este script para crearlo.")
        return

    creds = None

    if TOKEN_FILE.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)

    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
    elif not creds or not creds.valid:
        flow = InstalledAppFlow.from_client_secrets_file(str(CLIENT_FILE), SCOPES)
        creds = flow.run_local_server(port=0)

    with open(TOKEN_FILE, "w") as f:
        f.write(creds.to_json())

    print(f"✅ Credenciales guardadas en {TOKEN_FILE}")
    print("Ya puedes usar la subida a Google Drive.")


if __name__ == "__main__":
    main()
