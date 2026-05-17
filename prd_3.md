# PRD: TikTok Linguistic Harvester & Transcriber
**Versión:** 4.0  
**Proyecto:** Herramienta de recolección y análisis de discurso para investigación lingüística  
**Investigadora:** Maite (Magíster en Lingüística)  
**Objetivo Científico:** Analizar la construcción de cercanía discursiva y las funciones de la segunda persona (*tú, vos, usted*) en videos de TikTok en español  
**Audiencia de este documento:** Agente de código (OpenCode / Cursor)

---

## 1. Resumen Ejecutivo

El sistema es una plataforma de **muestreo aleatorio controlado** para construir un corpus lingüístico de 400 videos de TikTok en español. La herramienta corre localmente en el servidor de la investigadora, automatiza la recolección y transcripción, y permite la validación y edición manual antes de guardar el corpus final en Google Drive.

**Usuario único:** Maite. No hay autenticación multi-usuario. No hay roles. La app corre en `localhost`.

---

## 2. Objetivos del Producto

| # | Objetivo | Criterio de éxito |
|---|----------|-------------------|
| 1 | **Muestreo aleatorio no sesgado** | El sistema extrae ≥1.500 candidatos y los baraja aleatoriamente antes de mostrarlos |
| 2 | **Validación rápida (Triage)** | Maite puede aprobar o rechazar un video en ≤10 segundos |
| 3 | **Transcripción editable** | Cada segmento de Whisper es un campo editable; solo se guarda lo que Maite aprueba |
| 4 | **Análisis lingüístico asistido** | Los pronombres de 2ª persona se resaltan automáticamente en la transcripción |
| 5 | **Persistencia entre sesiones** | Si Maite cierra la app y la reabre, el corpus y el progreso están intactos |
| 6 | **Exportación al corpus** | Al aprobar, el video queda sincronizado en Google Drive y exportable en CSV |

---

## 3. Marco Legal y Ético

> **Esta herramienta es para uso en investigación académica.** El siguiente marco debe documentarse en la tesis/proyecto de Maite.

### 3.1. Uso de yt-dlp con TikTok
- `yt-dlp` extrae únicamente el **audio** (`.mp3`) de videos públicos. No descarga ni almacena el video completo.
- Solo se procesan videos de perfiles **públicos**. No se accede a contenido privado o restringido.
- El uso cae bajo el principio de **fair use académico** para análisis lingüístico no comercial.
- Los datos personales de los creadores (username, descripción) se usan solo como metadatos de identificación del corpus, no como objeto de análisis.

### 3.2. Almacenamiento y anonimización
- Los archivos de audio (mp3) y video (mp4) temporales se eliminan automáticamente tras la transcripción o al rechazar el video. Al aprobar, se suben a Google Drive en una carpeta por video.
- El corpus final contiene: ID del video, transcripción de texto, hashtags y metadatos básicos. **No se almacenan miniaturas ni medios audiovisuales.**
- Google Drive usado es la cuenta personal académica de la investigadora.

### 3.3. Limitaciones técnicas de la recolección
- TikTok no provee API pública de búsqueda por hashtag. La recolección se hace mediante el envío manual de URLs desde la extensión del navegador.
- El usuario navega TikTok normalmente, encuentra un video relevante, y hace clic en el botón de la extensión para enviar la URL al servidor.
- **TikTok implementa rate limiting y puede bloquear requests.** El backend debe manejar esto con reintentos y delays (ver sección 5.2).

---

## 4. Arquitectura del Sistema

### 4.1. Infraestructura (Servidor Local)

| Componente | Especificación |
|------------|---------------|
| CPU | Xeon 2680 v4 — 14 núcleos / 28 hilos |
| RAM | 48 GB DDR4 |
| Conexión | 600 Mbps Fibra Óptica |
| OS | Arch Linux (primario) / Windows 10/11 con Docker Desktop (secundario) |
| Acceso | `http://localhost:3000` (frontend) / `http://localhost:8000` (API) |

### 4.2. Stack Tecnológico

| Capa | Tecnología | Notas |
|------|-----------|-------|
| Frontend | React + TypeScript + Tailwind CSS | Generado con v0.dev como base |
| Backend | FastAPI (Python 3.11+) | API REST |
| Base de datos | PostgreSQL 16 (Docker) | Persistencia local, concurrencia con Celery |
| Motor de descarga | `yt-dlp` + ffmpeg | Extrae audio como `.mp3` |
| Motor de transcripción | `faster-whisper` modelo `medium` | `cpu_threads=28`, `language="es"` |
| Cola de tareas | Celery + Redis | Para descargas y transcripciones en background |
| Almacenamiento cloud | Google Drive API v3 (opcional) | OAuth2 con cuenta de Maite |
| Audio temporal | `./tmp/harvester/` | Ruta relativa, compatible Linux/Windows. Eliminado al transcribir o rechazar |

---

## 5. Requerimientos Funcionales

### 5.1. Módulo de Descubrimiento e Ingesta (Extension-Driven)

**Flujo de trabajo:**
1. Maite navega TikTok en su navegador, encuentra un video relevante para su corpus.
2. Hace clic en el botón flotante "Enviar al corpus" que inyecta la extensión.
3. La extensión captura la URL de la página actual de TikTok y la envía al servidor.
4. El servidor recibe la URL y la encola para procesamiento (descarga + transcripción).

**Entrada del usuario (desde la extensión):**
- La extensión captura automáticamente `window.location.href` del video de TikTok.
- Envía la URL a `POST /api/ingesta` con `urls_manuales=[url]`.

**Manejo de errores de red (crítico):**
- Si `yt-dlp` recibe un error 429 (rate limit) o bloqueo de TikTok: esperar entre 15-60 segundos (delay aleatorio) y reintentar hasta 3 veces.
- Si un video es inaccesible (privado, eliminado): ignorarlo y continuar con el siguiente.
- Loggear todos los errores en `logs/harvester.log` sin interrumpir la sesión.

### 5.2. Flujo de Transcripción — Timing Explícito

> **Este punto es crítico para la implementación.** Define exactamente cuándo se ejecuta Whisper.

**La transcripción ocurre en dos fases separadas:**

**Fase A — Pre-Triage (background, al ingestar el pool):**
- Cuando se ingestan los ~1.500 videos al pool, el sistema descarga el audio y ejecuta Whisper en background (cola Celery) para los primeros **60 videos** del pool shuffleado.
- El objetivo es tener los primeros 3 bloques de Triage ya transcritos antes de que Maite empiece a revisar.
- El estado de cada video en la tabla `videos` refleja esto: `status = 'transcripto_pendiente'` (audio descargado y transcrito, esperando revisión de Maite).
- A medida que Maite avanza en el Triage, el sistema pre-transcribe los siguientes bloques en background (sliding window de 60 videos adelante).

**Fase B — Post-Aprobación (al hacer clic en "Aprobar"):**
- El Worker de Celery (sección 5.4) toma la transcripción **ya editada por Maite** y la sube a Google Drive junto con el audio.
- No re-ejecuta Whisper. El audio ya fue descargado en la Fase A.

**Estados del video:**

| Status | Significado |
|--------|-------------|
| `pendiente` | URL recibida, esperando turno en la cola |
| `descargando` | yt-dlp descargando el audio como mp3 |
| `transcribiendo` | Whisper transcribiendo el audio |
| `listo_para_triage` | Transcripción disponible, esperando revisión |
| `aprobado` | Transcripción aprobada y guardada |
| `rechazado` | Video rechazado, archivos eliminados |
| `error` | Fallo en descarga o transcripción |

**Comportamiento en el Triage si la transcripción no está lista:**
- Si Maite llega a un video con `status = 'transcribiendo'`, mostrar un spinner con el texto "Transcribiendo audio..." y polling cada 3 segundos hasta que esté listo.
- No bloquear la sesión; Maite puede saltar al siguiente video.

### 5.3. Interfaz de Triage (Pantalla Principal)

**Layout:** Grid horizontal de 2 columnas, tarjetas anchas. Scroll independiente en la columna derecha.

#### Columna Izquierda — Video Player

**Estrategia de reproducción (dos modos con fallback automático):**

1. **Modo primario — Embed de TikTok:** El video se reproduce embebido via oEmbed/iframe desde TikTok. Es el modo preferido porque no requiere descarga del video.
2. **Modo fallback — Miniatura estática:** Si el embed falla (TikTok bloqueó el iframe, error de CORS, timeout de 5 segundos), mostrar la miniatura del video con un ícono de advertencia y el texto "Preview no disponible. Usa el audio para evaluar." El audio transcrito sigue disponible para revisión.

> **El agente debe implementar ambos modos.** No asumir que el embed de TikTok siempre funciona.

**Controles (cuando el embed está activo):** Hover-to-Play con audio, Play/Pause, Mute/Unmute, barra de progreso.

#### Columna Derecha — Panel de Información y Edición

**Editor Segmentado (Transcripción):**
- La transcripción se divide en segmentos por timestamp (output de Whisper).
- Cada segmento muestra: `[00:04 → 00:09]` + texto editable (`<textarea>`).
- Al hacer **clic en un segmento**, el video salta al segundo exacto (`video.currentTime = segmento.start`). Solo funciona en modo embed activo; en modo fallback, el clic no hace nada.
- Solo el texto corregido por Maite se guarda al aprobar. El texto original de Whisper se conserva en base de datos como campo separado (`transcript_original`) para comparación futura.

**Highlighting automático:**
Los siguientes tokens se resaltan visualmente (fondo amarillo) en tiempo real mientras Maite edita:
```
tú, vos, usted, te, ti, contigo, le, la, lo, os, ustedes, les
```
El highlighting es **case-insensitive** y respeta signos de puntuación adyacentes.

**Caja de Metadatos** (debajo de la transcripción):
- Descripción original del video
- Hashtags del video (mostrados como badges/chips)
- Username del creador
- Fecha de publicación (si disponible vía yt-dlp)
- Duración del video

#### Acciones
- **Botón "Aprobar" (verde):** Guarda el JSON de segmentos editados, dispara el worker de Celery (Fase B).
- **Botón "Rechazar" (rojo):** Marca el video como `rechazado` en la base de datos. No procesa nada más.
- **Contador de progreso:** `Aprobados: 87 / 400` visible en todo momento.

### 5.4. Worker de Procesamiento (Celery)

**Fase A — Pre-Triage (al recibir URL desde la extensión):**

```
1. Recibir URL del video desde POST /api/ingesta
2. Descargar audio con yt-dlp en formato mp3 → ./tmp/harvester/{video_id}.mp3
3. Ejecutar Whisper (faster-whisper, modelo medium) sobre el mp3
4. Guardar segmentos de transcripción en transcript_original (JSONB)
5. Status → "listo_para_triage"
6. En caso de error → status: "error", loggear en logs/harvester.log
```

**Fase B — Post-Aprobación (al hacer clic en "Aprobar"):**

```
1. Guardar la transcripción editada por Maite en transcript_editada (JSONB)
2. Generar archivo de texto plano con los segmentos editados → ./tmp/harvester/{video_id}.txt
3. Status → "aprobado"
4. (Opcional) Subir a Google Drive para respaldo
5. Eliminar archivo de audio mp3 temporal
6. En caso de error en cualquier paso → status: "error", loggear en logs/harvester.log
```

### 5.5. Gestión del Corpus (Segunda Pantalla)

**Tabla Maestra:**
- Lista paginada de todos los videos aprobados (thumbnails, username, extracto de texto, estado de Drive).
- Columnas: `#` | Thumbnail | Usuario | Extracto | Hashtags | Estado | Fecha aprobación.

**Buscador Global:**
- Búsqueda en texto completo sobre todas las transcripciones guardadas usando **PostgreSQL FTS** (`tsvector` / `tsquery` con configuración `spanish`).
- Útil para verificar frecuencias de pronombres antes de exportar.

**Exportación:**
- **"Sync to Drive":** Re-sube los archivos pendientes o fallidos.
- **"Descargar CSV":** Genera un archivo con columnas: `video_id, url, username, fecha, hashtags, transcript_editada, transcript_original`.

---

## 6. Persistencia y Estado entre Sesiones

> **Este es un requerimiento crítico.** La investigación tomará semanas. Maite debe poder cerrar la app y retomar exactamente donde la dejó.

**Base de datos:** PostgreSQL 16 corriendo en Docker. Se elige PostgreSQL sobre SQLite porque Celery Workers y FastAPI escriben simultáneamente, y SQLite no maneja bien esa concurrencia.

**Esquema principal — tabla `videos`:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | TEXT (PK) | ID único del video en TikTok |
| `url` | TEXT | URL completa |
| `username` | TEXT | Creador |
| `description` | TEXT | Descripción original |
| `hashtags` | JSONB | Lista de hashtags |
| `duration_sec` | INTEGER | Duración en segundos |
| `status` | TEXT | Ver tabla de estados en sección 5.2 |
| `transcript_original` | JSONB | Segmentos de Whisper sin editar |
| `transcript_editada` | JSONB | Segmentos editados por Maite |
| `drive_url` | TEXT | URL del archivo en Google Drive |
| `shuffle_order` | INTEGER | Preserva el orden aleatorio entre sesiones |
| `created_at` | TIMESTAMPTZ | Timestamp de ingesta |
| `approved_at` | TIMESTAMPTZ | Timestamp de aprobación |

**Estado del pool:**
- Los ~1.500 URLs del pool se guardan en PostgreSQL al iniciar la ingesta.
- Al reabrir la app, se cargan los videos con `status = 'listo_para_triage'` en el Triage.
- El orden aleatorio se preserva con la columna `shuffle_order`.

### 6.1. Docker Compose (Servicios de Infraestructura)

Solo PostgreSQL y Redis corren en Docker. FastAPI, Celery y el frontend corren directamente en el host (Linux o Windows).

```yaml
# docker-compose.yml
version: "3.9"
services:
  postgres:
    image: postgres:16-alpine
    container_name: corpus_db
    restart: unless-stopped
    environment:
      POSTGRES_USER: maite
      POSTGRES_PASSWORD: corpus2024
      POSTGRES_DB: corpus
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: corpus_redis
    restart: unless-stopped
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

**Comandos para iniciar la infraestructura:**
```bash
docker compose up -d        # Inicia PostgreSQL y Redis en background
docker compose down         # Detiene los contenedores (los datos persisten en el volumen)
docker compose down -v      # ⚠️ Elimina también los datos — solo para reset total
```

### 6.2. Compatibilidad Windows

> Esta sección aplica cuando el sistema corre en Windows 10/11 con Docker Desktop. Los contenedores Docker (PostgreSQL, Redis) son idénticos en ambos OS. Las diferencias están en los procesos del host.

#### 6.2.1. Celery en Windows — Configuración obligatoria

Celery no soporta el executor por defecto (`prefork`) en Windows. **Siempre** iniciar con `--pool=solo`:

```powershell
# Windows — PowerShell
celery -A app.worker worker --loglevel=info --pool=solo
```

```bash
# Linux / Arch — bash
celery -A app.worker worker --loglevel=info
```

> El agente debe generar scripts de arranque separados: `start.sh` (Linux) y `start.ps1` (Windows).

#### 6.2.2. Rutas de archivos temporales

La variable `TMP_AUDIO_DIR` usa una ruta **relativa al proyecto** (`./tmp/harvester`) que funciona en ambos OS. El agente debe usar `pathlib.Path` en Python para construir rutas, nunca strings con `/` hardcodeados:

```python
from pathlib import Path
TMP_DIR = Path(os.getenv("TMP_AUDIO_DIR", "./tmp/harvester"))
TMP_DIR.mkdir(parents=True, exist_ok=True)
```

#### 6.2.3. `faster-whisper` en Windows

En Windows, `faster-whisper` puede requerir las **Visual C++ Redistributable 2019** instaladas. Si al correr Whisper aparece un error de DLL, el agente debe incluir en el README la instrucción:

```
Instalar: https://aka.ms/vs/17/release/vc_redist.x64.exe
```

En esta configuración se usa CPU (no GPU), por lo que no se requieren drivers CUDA.

#### 6.2.4. Scripts de arranque

El agente debe generar ambos scripts en la raíz del proyecto:

**`start.sh` (Linux/Arch):**
```bash
#!/bin/bash
docker compose up -d
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
celery -A app.worker worker --loglevel=info &
cd frontend && npm run dev
```

**`start.ps1` (Windows/PowerShell):**
```powershell
docker compose up -d
Start-Process uvicorn -ArgumentList "app.main:app --host 0.0.0.0 --port 8000 --reload"
Start-Process celery -ArgumentList "-A app.worker worker --loglevel=info --pool=solo"
Set-Location frontend; npm run dev
```

---

## 7. Configuración y Variables de Entorno

El agente debe crear un archivo `.env` en la raíz del proyecto con las siguientes variables. Maite las llenará antes de correr la app por primera vez.

```env
# Google Drive
GOOGLE_DRIVE_CREDENTIALS_PATH=credentials/gdrive_credentials.json
GOOGLE_DRIVE_FOLDER_ID=<ID de la carpeta destino en Drive>

# Base de datos (PostgreSQL en Docker)
DATABASE_URL=postgresql://maite:corpus2024@localhost:5432/corpus

# Redis (en Docker)
REDIS_URL=redis://localhost:6379/0

# App
CORPUS_TARGET=400
POOL_SIZE=1500
TRIAGE_BLOCK_SIZE=20
PRETRANSCRIBE_WINDOW=60

# Whisper
WHISPER_MODEL=medium
WHISPER_CPU_THREADS=28
WHISPER_LANGUAGE=es

# Rutas (relativas al proyecto — funciona en Linux y Windows)
TMP_AUDIO_DIR=./tmp/harvester
LOG_FILE=logs/harvester.log
```

---

## 8. Instrucciones para el Agente de Código

> Esta sección es una guía de implementación directa para OpenCode o Cursor.

### ⚠️ Diseño Visual — NO modificar

El frontend fue generado con **v0.dev** (Vercel). El agente **no debe reescribir ni modificar el diseño visual, los estilos, ni los componentes de UI existentes.** Solo debe:
- Conectar los componentes existentes a los endpoints de FastAPI.
- Agregar lógica funcional (estado, eventos, llamadas a la API) dentro de los componentes ya creados.
- Si necesita un componente nuevo que no existe en v0, crearlo siguiendo el mismo estilo visual (Tailwind, misma paleta de colores, mismos tamaños de fuente).

**Nunca:** reemplazar componentes existentes, cambiar clases de Tailwind por conveniencia, ni instalar librerías de UI adicionales (shadcn, MUI, etc.) sin consultar.

### Orden de implementación recomendado:
1. **Setup del proyecto** — Estructura de carpetas, dependencias (`requirements.txt`, `package.json`), `.env`.
2. **Infraestructura Docker** — `docker compose up -d` para levantar PostgreSQL y Redis.
3. **Base de datos** — Modelos SQLAlchemy + migraciones con Alembic.
4. **Backend core** — Endpoints FastAPI: ingesta, listado de videos pendientes, aprobación, rechazo.
5. **Worker Celery — Fase A** — Descarga de audio + transcripción con Whisper en background (pre-Triage, sliding window de 60 videos).
6. **Worker Celery — Fase B** — Subida a Google Drive post-aprobación.
7. **Frontend Triage** — Conectar componentes v0 existentes: player con fallback, editor segmentado, highlighting y acciones.
8. **Frontend Corpus** — Conectar tabla maestra, buscador (FTS PostgreSQL), exportación CSV.
9. **Scripts de arranque** — `start.sh` y `start.ps1`.
10. **Tunnel Cloudflare** — Configurar acceso remoto (ver sección 9).
11. **Integración y pruebas** — Probar flujo completo con 5 videos reales.

### Decisiones de implementación explícitas:
- **Sin autenticación.** La app corre en localhost o detrás de Cloudflare Tunnel. No implementar login ni JWT.
- **PostgreSQL y Redis en Docker.** FastAPI, Celery y el frontend corren en el host directamente.
- **El estado de Celery** (pending/success/failure) debe reflejarse en la UI con polling cada 3 segundos.
- **Scroll independiente:** La columna derecha (transcripción + metadatos) debe tener `overflow-y: auto` con altura máxima fija, sin afectar el scroll de la página.
- **Guardar texto editado, no original:** Al hacer clic en "Aprobar", el frontend envía el contenido actual de cada `textarea`, no el texto inicial de Whisper.
- **Sincronización de video:** `video.currentTime = segmento.start` al clic en cada segmento (solo en modo embed activo).
- **Highlighting en tiempo real:** Implementar con expresión regular sobre el contenido del textarea mientras Maite edita, sin retraso perceptible.
- **Rutas con `pathlib.Path`:** Nunca usar strings con `/` hardcodeados para rutas de archivos.
- **Celery en Windows:** Usar `--pool=solo` siempre en el script `start.ps1`.

### Dependencias Python esperadas:
```
fastapi
uvicorn
sqlalchemy
alembic
asyncpg
celery
redis
yt-dlp
faster-whisper
google-api-python-client
google-auth-oauthlib
python-dotenv
psycopg2-binary
```

---

## 9. Casos Borde y Comportamiento Esperado

| Situación | Comportamiento esperado |
|-----------|------------------------|
| Video eliminado o privado al intentar descargar audio | Status → `error`. Notificar en UI. No bloquear la sesión. |
| Whisper no detecta habla (video de baile sin voz) | Transcripción vacía. Maite puede rechazar manualmente. |
| Maite rechaza un video | Status → `rechazado`. Archivo mp3 en `./tmp/harvester/` eliminado automáticamente. |
| Embed de TikTok bloqueado en el Triage | Activar modo fallback: miniatura estática + aviso. La transcripción sigue disponible. |
| Google Drive sin espacio o error de autenticación | Loggear error. Status → `error`. Botón "Reintentar" en la UI. |
| Pool agotado antes de llegar a 400 aprobados | Notificar a Maite y ofrecer iniciar nueva ingesta con otros hashtags. |
| App cerrada con worker en ejecución | Al reabrir, verificar videos con status `listo_para_triage` sin `drive_url` y re-encolar Fase B. |
| Conexión a TikTok bloqueada (rate limit) | Espera aleatoria 15-60s + 3 reintentos. Si persiste, pausar ingesta y notificar. |
| PostgreSQL o Redis caídos al iniciar | FastAPI debe mostrar error claro en consola: "No se puede conectar a la base de datos. Ejecuta: docker compose up -d" |
| Celery iniciado sin `--pool=solo` en Windows | El agente debe detectar el OS en `start.ps1` y forzar el flag. No es responsabilidad de Maite. |

---

## 10. Despliegue Remoto con Cloudflare Tunnel

> Esta sección permite que Maite acceda a la app desde cualquier dispositivo, sin que el servidor esté físicamente disponible para ella.

### ¿Qué es Cloudflare Tunnel?
Crea un túnel cifrado entre tu PC (el servidor) y la red de Cloudflare. Maite accede a una URL pública fija (ej. `corpus-maite.tudominio.com`) y Cloudflare redirige el tráfico a tu máquina local. **No requiere abrir puertos en el router ni tener IP fija.**

### Requisitos previos
- Cuenta gratuita en [cloudflare.com](https://cloudflare.com)
- Un dominio propio (puede ser uno gratuito vía Cloudflare, o cualquier dominio que ya tengas)
- `cloudflared` instalado en el servidor

### Instalación

**Arch Linux:**
```bash
yay -S cloudflared
# o con el AUR directamente:
paru -S cloudflared
```

**Windows:**
```powershell
winget install Cloudflare.cloudflared
# o descargar el instalador desde: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
```

### Configuración paso a paso

**1. Autenticarse con Cloudflare:**
```bash
cloudflared tunnel login
# Abre el navegador para autorizar. Guarda el certificado en ~/.cloudflared/
```

**2. Crear el túnel:**
```bash
cloudflared tunnel create corpus-maite
# Guarda el UUID del túnel que aparece — lo necesitas en el siguiente paso
```

**3. Crear el archivo de configuración:**
```yaml
# ~/.cloudflared/config.yml  (Linux)
# %USERPROFILE%\.cloudflared\config.yml  (Windows)
tunnel: <UUID-del-tunnel>
credentials-file: /home/<tu-usuario>/.cloudflared/<UUID-del-tunnel>.json  # Ajustar en Windows

ingress:
  - hostname: corpus-maite.tudominio.com
    service: http://localhost:3000      # Frontend React
  - hostname: api-corpus-maite.tudominio.com
    service: http://localhost:8000      # FastAPI backend
  - service: http_status:404
```

**4. Crear el registro DNS en Cloudflare:**
```bash
cloudflared tunnel route dns corpus-maite corpus-maite.tudominio.com
cloudflared tunnel route dns corpus-maite api-corpus-maite.tudominio.com
```

**5. Iniciar el túnel:**
```bash
cloudflared tunnel run corpus-maite
```

**6. (Opcional) Configurar como servicio del sistema:**

*Linux (systemd):*
```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

*Windows (servicio):*
```powershell
cloudflared service install
# Se instala y arranca automáticamente con Windows
```

### Resultado
- Maite accede a `https://corpus-maite.tudominio.com` desde cualquier dispositivo.
- El frontend llama a `https://api-corpus-maite.tudominio.com` para la API.
- Tu PC puede estar detrás de NAT, con IP dinámica, sin problema.
- **Costo:** Gratis para un túnel con tráfico moderado (uso académico).

### Consideración de seguridad
El túnel es público por URL. Si se quiere restringir el acceso solo a Maite, Cloudflare Access (también gratuito para 1 usuario) permite proteger la URL con login de Google/email sin necesidad de implementar autenticación en la app.

---

*Documento generado para uso con agentes de código. Versión 3.1.*
