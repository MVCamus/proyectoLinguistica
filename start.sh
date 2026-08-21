#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -d ".venv" ]; then
    echo "[1/4] Creando entorno virtual..."
    python3 -m venv .venv || python -m venv .venv
fi

if [ -d "$SCRIPT_DIR/.venv/Scripts" ]; then
    export PATH="$SCRIPT_DIR/.venv/Scripts:$PATH"
    PYTHON_CMD="$SCRIPT_DIR/.venv/Scripts/python"
elif [ -d "$SCRIPT_DIR/.venv/bin" ]; then
    export PATH="$SCRIPT_DIR/.venv/bin:$PATH"
    PYTHON_CMD="$SCRIPT_DIR/.venv/bin/python"
else
    PYTHON_CMD="python"
fi

echo "[1/4] Instalando dependencias Python..."
"$PYTHON_CMD" -m pip install -r requirements.txt --quiet

export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    \. "$NVM_DIR/nvm.sh"
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "[2/4] Instalando dependencias del Frontend..."
    (cd frontend && npm install)
fi

echo "[3/4] Iniciando API (FastAPI)..."
"$PYTHON_CMD" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &
UVICORN_PID=$!

echo "[4/4] Iniciando Frontend (Next.js)..."
cd frontend && npm run dev &
FRONTEND_PID=$!
cd "$SCRIPT_DIR"

echo ""
echo "Servicios iniciados:"
echo "  Frontend:  http://localhost:3000"
echo "  API:       http://localhost:8000"
echo "  Docs:      http://localhost:8000/docs"
echo ""
echo "Presiona Ctrl+C para detener todos los servicios."

trap "kill $UVICORN_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM
wait
