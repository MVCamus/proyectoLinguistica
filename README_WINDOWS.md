# Maite Corpus

Herramienta para descargar, transcribir y analizar videos de TikTok para investigación lingüística.

---

## Requisitos del sistema

- **Sistema operativo:** Windows 10 u 11 (64 bits)
- **Espacio en disco:** ~10 GB libres
- **Internet:** Conexión estable
- **PC recomendada:** i5 o superior, 8+ GB de RAM

---

## Instalación paso a paso

### Paso 1: Instalar Python

1. Abre Chrome o Edge
2. Ve a: https://www.python.org/downloads/
3. Haz clic en el botón amarillo **"Download Python 3.11"** (o 3.10+)
4. Cuando descargue, **ejecuta el instalador**
5. ✅ **IMPORTANTE:** Marca la opción **"Add Python to PATH"** (abajo de todo)
6. Haz clic en **"Install Now"**
7. Espera que termine y cierra

**Para verificar:** abre el menú inicio, escribe `cmd` y presiona Enter. En la ventana negra escribe:
```
python --version
```
Debe mostrar algo como `Python 3.11.x`. Si no, reinicia la PC y prueba de nuevo.

---

### Paso 2: Instalar Node.js

1. Ve a: https://nodejs.org/
2. Haz clic en el botón verde **"LTS"** (la versión recomendada)
3. Ejecuta el instalador
4. Deja todas las opciones por defecto, haz clic en **"Next"** hasta que termine

**Para verificar:** abre cmd y escribe:
```
node --version
```
Debe mostrar algo como `v20.x.x`.

---

### Paso 3: Instalar ffmpeg

1. Ve a: https://www.gyan.dev/ffmpeg/builds/
2. Baja hasta donde dice **"release builds"**
3. Haz clic en **"ffmpeg-release-full.7z"** (el archivo pesado)
4. Cuando descargue, abre el archivo .7z (necesitas **7-Zip** instalado)
5. Dentro del .7z hay una carpeta que se llama `ffmpeg-...`. Dentro de esa carpeta hay otra carpeta llamada `bin`
6. Copia la carpeta `bin` completa
7. Pega en `C:\ffmpeg` (que quede `C:\ffmpeg\bin`)
8. Agrega ffmpeg al sistema:
   - Clic derecho en el botón **Inicio** → **"System"** (Sistema)
   - **"About"** → **"Advanced system settings"**
   - Clic en **"Environment Variables..."**
   - En **"System variables"**, busca la variable **"Path"**, selecciónala y clic en **"Edit"**
   - Clic en **"New"** y escribe: `C:\ffmpeg\bin`
   - Clic en **"OK"** en todas las ventanas

---

### Paso 4: Instalar Visual C++ Redistributable

1. Ve a: https://aka.ms/vs/17/release/vc_redist.x64.exe
2. El archivo se descarga solo
3. Ejecútalo, acepta los términos y **"Install"**
4. Si dice que ya está instalado, mejor

---

### Paso 5: Descargar el proyecto

1. Descarga la carpeta del proyecto desde donde te lo compartan
2. Guárdala en una carpeta sin espacios en el nombre (ejemplo: `C:\Maite` o `C:\Users\tu_usuario\Documents\Maite`)
3. **No la guardes en OneDrive, Dropbox ni Google Drive** — puede dar problemas

---

### Paso 6: Ejecutar el sistema por primera vez

1. Abre la carpeta del proyecto
2. Busca el archivo **`start.bat`**
3. Haz doble clic en **`start.bat`**
4. Aparecerá una ventana negra. **No la cierres**

**¿Qué debe pasar?**
- La primera vez se va a crear el entorno virtual automáticamente y va a instalar las dependencias (tarda ~5 minutos)
- Se va a abrir la API (puerto 8000) y el frontend (puerto 3000)
- La ventana muestra las URLs de los servicios
- **Para detener todo:** cerrá la ventana negra con la X, o presioná Ctrl+C

> Si al hacer doble clic no funciona, abrí la carpeta, hacé clic en la barra de direcciones de arriba, escribí `cmd` y Enter. Después escribí `start.bat` y Enter.

---

### Paso 7: Cargar la extensión en Chrome

1. Abre **Chrome** o **Edge**
2. En la barra de direcciones, ve a:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
3. Activa el interruptor de arriba a la derecha: **"Developer mode"** (Modo desarrollador)
4. Haz clic en **"Load unpacked"** (Cargar sin empaquetar)
5. Busca la carpeta del proyecto, entra a la subcarpeta **`extension`** y selecciónala
6. Aparecerá un icono nuevo en la barra de extensiones (arriba a la derecha)

---

### Paso 8: Usar el sistema

1. **En el navegador:** ve a `http://localhost:3000`
2. **En TikTok:** abre TikTok en otra pestaña, ve a un video, haz clic en el botón verde **"Enviar al corpus"** que aparece abajo a la derecha
3. **En la web:** espera unos segundos y el video aparece en "Listos para revisar"
4. **Para aprobar/rechazar:** lee la transcripción, edita si es necesario, y haz clic en **"Aprobar"** (verde) o **"Rechazar"** (rojo)
5. **Selected Corpus:** los videos aprobados aparecen en esta sección. Podés descargarlos como CSV o se suben automáticamente a Google Drive

---

### Paso 9: Configurar Google Drive (Opcional)

Para que los videos aprobados se suban automáticamente a Google Drive:

1. Ve a https://console.cloud.google.com/
2. Haz clic en el menú de arriba (junto a "Google Cloud") y crea un **nuevo proyecto** (nombre "Maite")
3. Ve a **"APIs & Services"** → **"Library"**
4. Busca **"Google Drive API"** y haz clic → **"Enable"**
5. Ve a **"APIs & Services"** → **"Credentials"** → **"Create Credentials"** → **"OAuth client ID"**
6. Elige **"Desktop app"** → pon nombre "Maite" → **"Create"**
7. Haz clic en **"Download JSON"**
8. Guarda el archivo como `credentials/gdrive_client_id.json` dentro de la carpeta del proyecto
9. Ve a **"APIs & Services"** → **"OAuth consent screen"**
10. En **"Test users"** → **"Add Users"** → pon tu correo de Gmail → **"Save"**

**Para autorizar:**
1. Abrí la carpeta del proyecto
2. Hacé clic en la barra de direcciones, escribí `cmd` y Enter
3. Escribí: `.venv\Scripts\python setup_drive.py`
4. Se abrirá el navegador. Inicia sesión con tu Gmail y haz clic en **"Continue"**

---

## Para detener todo

**Solo cerrá la ventana negra** (con la X). Todos los servicios se detienen automáticamente.

Tus datos se guardan en el archivo `corpus.db`. Cuando vuelvas a iniciar con `start.bat`, todo el progreso sigue ahí.

---

## Solución de problemas

| Problema | Solución |
|----------|----------|
| **Al hacer doble clic en start.bat se cierra solo** | Abrí cmd en la carpeta y ejecutá `start.bat` para ver el error |
| **"python" no se reconoce** | Instalá Python y marcá "Add Python to PATH", reiniciá la PC |
| **"node" no se reconoce** | Instalá Node.js desde nodejs.org |
| **pip no existe** | Instalá Python y marcá "Add Python to PATH" |
| **El botón de la extensión no funciona** | Abrí la consola (F12) en TikTok y revisá si hay errores en rojo |
| **No se ven videos en la web** | Esperá ~15 segundos, la transcripción tarda un poco |
| **La extensión muestra "Error"** | Asegurate que la API esté corriendo (`start.bat` abierto). Si ya está, recargá TikTok |
| **Error de ffmpeg** | Instalá ffmpeg siguiendo el Paso 3 y reiniciá la PC |
| **Se perdió el progreso al cerrar** | El progreso se guarda automáticamente en `corpus.db`. No borres ese archivo |
| **Error de GPU / CUDA** | No necesitás GPU, funciona en CPU automáticamente |

---

## Notas importantes

- La primera vez que se ejecute **faster-whisper**, descargará el modelo (~1.5 GB). La descarga es automática pero tarda unos minutos.
- Los videos aprobados se suben a Google Drive automáticamente (si configuraste el Paso 9).
- Los rechazados se eliminan permanentemente.
- El sistema procesa **un video a la vez** para no saturar el PC.
- Podés cerrar la web y volver a abrirla — el progreso se guarda en `corpus.db`.
- Para cambiar configuración (idioma, hilos de Whisper, etc.), editá el archivo `.env` dentro de la carpeta del proyecto.
