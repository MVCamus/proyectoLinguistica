# 📚 Plataforma de Recolección y Procesamiento de Corpus Lingüístico (TikTok)

> [!IMPORTANT]
> **Requisitos Previos Obligatorios:** Para ejecutar este proyecto debes tener instalados previamente en tu sistema:
> * **[Python](https://www.python.org/downloads/) (versión 3.11 o superior)** *(en Windows asegúrate de marcar la casilla *"Add Python to PATH"* durante la instalación)*.
> * **[Node.js](https://nodejs.org/) (versión 18 o superior)** con su gestor de paquetes `npm`.

> **Plataforma integral para la recolección, transcripción automática mediante IA y procesamiento de videos de TikTok utilizados en una investigación académica sobre el uso de expresiones de segunda persona en redes sociales.**

<div align="center">

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.12+-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.x-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.x-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Faster-Whisper](https://img.shields.io/badge/Faster--Whisper-CTranslate2-green)](https://github.com/SYSTRAN/faster-whisper)
[![Google Drive API](https://img.shields.io/badge/Google%20Drive-API%20v3-4285F4?logo=googledrive&logoColor=white)](https://developers.google.com/drive)
[![Chrome Extension](https://img.shields.io/badge/Extension-Manifest%20V3-blue?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/)

</div>

---

## 📖 Descripción del Proyecto

El proyecto consiste en el desarrollo de una plataforma para la recolección y procesamiento de videos de TikTok utilizados en una investigación académica sobre el uso de expresiones de segunda persona en redes sociales.

El sistema permite incorporar videos mediante una extensión para navegador.

A partir de los videos recopilados, el sistema obtiene información como usuario, descripción, hashtags y duración, además de procesar el audio para generar transcripciones automáticas mediante el modelo Faster-Whisper.

Las transcripciones pueden ser revisadas y editadas antes de ser incorporadas al corpus, permitiendo identificar expresiones lingüísticas relevantes para la investigación.

Finalmente, la información y los archivos generados son organizados y respaldados automáticamente, facilitando la gestión del corpus y su posterior utilización en el proceso de investigación.

---

## 📸 Vistas Reales del Proyecto

Capturas tomadas directamente de los componentes e interfaz real del sistema:

### 1. Panel de Monitoreo y Transcripciones
<div align="center">
  <img src="frontend/public/Transcripciones.png" alt="Panel de Monitoreo y Transcripciones" width="850" style="border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.12);" />
  <p><em>Monitoreo en vivo de la cola de procesamiento, resaltado lingüístico automático de segunda persona (tú) en amarillo, timestamps y editor interactivo de transcripciones.</em></p>
</div>

---

### 2. Exploración y Gestión del Corpus
<div align="center">
  <img src="frontend/public/Lista_Corpus.png" alt="Lista y Exploración del Corpus" width="850" style="border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.12);" />
  <p><em>Tabla de videos aprobados con numeración correlativa, buscador inteligente, métricas de progreso hacia la meta y acciones rápidas de mantenimiento y respaldo en Google Drive.</em></p>
</div>

---

## 🚀 Funcionalidades del Sistema

### 1. Captura e Ingesta de Videos

* **Botón flotante en TikTok (Extensión de Chrome/Edge)**  
  El usuario navega en TikTok de forma normal. Al encontrar un video relevante, presiona el botón verde flotante "📚 Enviar al corpus" en la esquina inferior derecha.

---

### 2. Panel de Monitoreo

* **Monitoreo en vivo de la cola**  
  El usuario ve en tiempo real qué videos se están descargando, cuáles se están transcribiendo y cuáles están listos para revisar.

* **Resaltado lingüístico automático**  
  En cada transcripción, el sistema resalta automáticamente en amarillo los pronombres y formas de segunda persona (tú).

* **Editor interactivo de transcripción**  
  Cada frase del video aparece con su marca de tiempo (0:05, 0:14). El usuario puede hacer clic sobre cualquier segmento y corregir el texto directamente si Whisper cometió algún error.

* **Visualización**  
  Acceso a un enlace directo para abrir el video en TikTok si se desea.

* **Aprobación o rechazo en un clic**  
  * **Aprobar (botón verde):** Guarda la transcripción editada directamente como archivo .txt en el computador (en la raíz del proyecto), le asigna su número correlativo (001_usuario.txt) y lo transfiere a la lista final de aprobados.
  * **Rechazar (botón rojo):** Descarta el video y elimina todos los archivos temporales de la computadora.

* **Reintento de errores**  
  Si un video falla por saturación de red o CAPTCHA de TikTok, la interfaz muestra el motivo y un botón de refresco para volver a intentarlo.

---

### 3. Exploración y Búsqueda en el Corpus Seleccionado

* **Barra de búsqueda inteligente**  
  Búsqueda por número exacto de video (ej. escribir 15 para ir directamente al video 15), por nombre de usuario (@creador), por texto dentro de la transcripción o por ID.

* **Ordenamiento personalizado**  
  El usuario puede ordenar su lista por número de corpus (ascendente o descendente), fecha de aprobación, duración del video o nombre de autor.

* **Contador de progreso**  
  Muestra en todo momento el avance acumulado respecto a la meta del proyecto (por ejemplo, 146 videos aprobados).

---

### 4. Gestión y Eliminación de Videos Aprobados

* **Eliminación con renumeración automática**  
  Si el usuario decide eliminar un video ya aprobado (por ejemplo, el video #10), el sistema se encarga de reordenar todos los videos siguientes (#11 → #10, #12 → #11) sin que el usuario tenga que cambiar los nombres manualmente.

---

### 5. Herramientas de Mantenimiento

En la parte superior de la vista de Corpus, el usuario dispone de cuatro botones de acción rápida:

* **Verificar TXT**  
  Revisa en segundos si todas las transcripciones aprobadas tienen su archivo .txt correspondiente en la carpeta del proyecto.

* **Sincronizar TXT**  
  Si falta algún archivo .txt, el usuario presiona este botón y el sistema los regenera automáticamente mostrando una barra de progreso.

* **Corregir Numeración**  
  Corrige cualquier salto o hueco en la numeración correlativa de los videos.

* **Sincronizar Drive**  
  Sube y organiza automáticamente los archivos a Google Drive en carpetas ordenadas en lotes de 100 (videos 1–100, videos 101–200). Por cada video aprobado se respaldan 3 elementos: un archivo .txt con los hashtags y la URL del video, un segundo archivo .txt con la transcripción completa, y el archivo de video (.mp4) correspondiente asociado a dicha metadata y transcripción.

---

## 🛠️ Stack Tecnológico

| Capa / Módulo | Tecnologías y Librerías |
|---|---|
| **Backend & API** | Python 3.11+, FastAPI, SQLAlchemy (Async), Pydantic, Uvicorn, Asyncpg |
| **Modelos de IA & Audio** | Faster-Whisper (OpenAI Whisper optimizado con CTranslate2, cuantización `int8` y VAD filter), ffmpeg |
| **Frontend & UI** | Next.js 16 (App Router), React 19, TypeScript, TailwindCSS 4, Radix UI (shadcn/ui), Lucide React, Sonner |
| **Extensión de Navegador** | Manifest V3 (Google Chrome & Microsoft Edge), Content Scripts, Service Worker |
| **Descarga & Media** | Ingesta en cascada (TikWM API, Lovetik API, CDN stream, fallback yt-dlp) |
| **Base de Datos & Nube** | PostgreSQL (Supabase) con SQLAlchemy asíncrono, Google Drive API v3 (OAuth2 / Service Account) |

---

## ⚙️ Configuración del Entorno (`.env`)

Crea un archivo llamado `.env` en la raíz del proyecto (puedes guiarte con `.env.example`):

```env
# 1. Google Drive (ID de la carpeta raíz donde se organizarán los videos)
# Ejemplo: si tu URL es drive.google.com/drive/folders/1w8ZyD9HQOyedfLpW3DOrYwN_GcNSSy8r?hl=es
# solo debes colocar el ID limpio:
GOOGLE_DRIVE_FOLDER_ID=1w8ZyD9HQOyedfLpW3DOrYwN_GcNSSy8r

# 2. Base de datos (PostgreSQL / Supabase)
# Copia la URI de conexión de tu proyecto de Supabase (Settings -> Database -> Connection String -> URI):
DATABASE_URL=postgresql+asyncpg://postgres.TU_PROYECTO:TU_PASSWORD@aws-1-sa-east-1.pooler.supabase.com:5432/postgres

# 3. Metas y configuración de la app
CORPUS_TARGET=400
POOL_SIZE=1500
TRIAGE_BLOCK_SIZE=20

# 4. Whisper (Modelo de IA y rendimiento)
WHISPER_MODEL=medium
WHISPER_CPU_THREADS=4
WHISPER_LANGUAGE=es

# 5. Rutas temporales y logs
TMP_AUDIO_DIR=./tmp/harvester
LOG_FILE=logs/harvester.log
```

---

## 💻 Puesta en Marcha

El sistema cuenta con scripts automatizados (`start.bat` para Windows y `start.sh` para Linux/macOS) que realizan todo el proceso de inicio en una **única consola**:
1. Verifican y crean el entorno virtual de Python (`.venv`).
2. Instalan automáticamente las dependencias de Python (`requirements.txt`).
3. Instalan automáticamente las dependencias del frontend (`frontend/node_modules`).
4. Ejecutan **FastAPI (puerto 8000)** y **Next.js (puerto 3000)** de forma simultánea en la **misma consola**.

---

### 🪟 En Windows (Recomendado)

Haz doble clic en el archivo **`start.bat`** (o ejecútalo desde tu terminal CMD / PowerShell):
```cmd
start.bat
```
* **Paso 1:** Creará el `.venv` e instalará dependencias de Python (`[1/4]`).
* **Paso 2:** Instalará dependencias de Node.js en `frontend/` (`[2/4]`).
* **Paso 3:** Levantará la API de FastAPI en `http://localhost:8000` (`[3/4]`).
* **Paso 4:** Levantará el Frontend de Next.js en `http://localhost:3000` (`[4/4]`).
* Ambos servicios se mantienen ejecutándose en la **misma ventana de consola**. Para detener todo, simplemente presiona `Ctrl+C` o cierra la ventana.

---

### 🐧 En Linux / macOS / Git Bash

Otorga permisos de ejecución y ejecuta el script:
```bash
chmod +x start.sh
./start.sh
```
* El script instalará automáticamente las dependencias de Python y Frontend y ejecutará ambos servidores en la misma terminal.

---

### 🌐 Acceso a la Plataforma

Una vez iniciados los servicios:
* **Frontend Web:** [http://localhost:3000](http://localhost:3000)
* **Backend API (FastAPI):** [http://localhost:8000](http://localhost:8000)
* **Documentación interactiva (Swagger/Docs):** [http://localhost:8000/docs](http://localhost:8000/docs)

---

### 🧩 Extensión para Navegador (Chrome / Edge)

1. Abre tu navegador y ve a:
   * **Chrome:** `chrome://extensions/`
   * **Edge:** `edge://extensions/`
2. Activa la casilla de **"Modo de desarrollador"** (arriba a la derecha).
3. Haz clic en **"Cargar extensión sin empaquetar"** (*Load unpacked*).
4. Selecciona la carpeta **`/extension`** de este proyecto.
5. Al navegar en TikTok, el botón flotante **"📚 Enviar al corpus"** aparecerá en la esquina inferior derecha para recolectar videos directamente a la plataforma.
