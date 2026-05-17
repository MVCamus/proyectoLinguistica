#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

export PATH="$SCRIPT_DIR/.venv/bin:$PATH"

export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    \. "$NVM_DIR/nvm.sh"
fi

echo "==> Iniciando FastAPI..."
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
UVICORN_PID=$!

echo "==> Iniciando Frontend..."
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
