import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import update

from app.config import settings
from app.database import async_session, init_db
from app.models import Video
from app.routes.videos import router as videos_router
from app.worker import avanzar_ventana_transcripcion

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

logger = logging.getLogger("maite")

_background_tasks: set[asyncio.Task] = set()


def _background(task: asyncio.Task) -> None:
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Base de datos: %s", settings.database_url)
    logger.info("=== INICIALIZANDO BASE DE DATOS ===")
    await init_db()

    # Resetear videos trabados por cierre abrupto
    async with async_session() as session:
        result = await session.execute(
            update(Video)
            .where(Video.status.in_(["descargando", "transcribiendo"]))
            .values(status="pendiente")
        )
        if result.rowcount:
            logger.info("Videos reseteados a pendiente: %d", result.rowcount)
        await session.commit()

    logger.info("Arrancando ventana de transcripcion...")
    _background(asyncio.create_task(avanzar_ventana_transcripcion()))

    logger.info("=== MAITE CORPUS API INICIADA ===")
    yield
    logger.info("=== MAITE CORPUS API DETENIDA ===")


app = FastAPI(title="Maite Corpus API", version="0.1.0", lifespan=lifespan)

# CORS abierto para desarrollo local
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return JSONResponse({"status": "ok", "version": "0.1.0"})


app.include_router(videos_router, prefix="/api")
