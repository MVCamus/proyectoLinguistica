@echo off
cd /d "%~dp0"

set VENV_PYTHON=%~dp0.venv\Scripts\python.exe

:: Crear .venv si no existe
if not exist "%VENV_PYTHON%" (
    echo [1/4] Creando entorno virtual...
    python -m venv .venv
    if not exist "%VENV_PYTHON%" (
        echo ERROR: No se pudo crear el entorno virtual.
        echo Asegurate de tener Python instalado.
        pause
        exit /b 1
    )
)

:: Instalar dependencias Python
echo [1/4] Instalando dependencias Python...
"%VENV_PYTHON%" -m pip install -r requirements.txt --quiet 2>nul

:: Instalar dependencias del frontend
if not exist "%~dp0frontend\node_modules" (
    echo [2/4] Instalando dependencias del Frontend...
    cd /d "%~dp0frontend"
    call npm install
    cd /d "%~dp0"
)

:: Iniciar API
echo [3/4] Iniciando API...
start /b "" "%VENV_PYTHON%" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > nul 2>&1

timeout /t 3 /nobreak >nul

:: Iniciar Frontend
echo [4/4] Iniciando Frontend...
start /b "" cmd /c "cd /d "%~dp0frontend" && npm run dev" > nul 2>&1

echo ==========================================
echo   Frontend:  http://localhost:3000
echo   API:       http://localhost:8000
echo ==========================================
echo Cerra esta ventana para detener todo

:loop
timeout /t 10 /nobreak >nul
goto loop
