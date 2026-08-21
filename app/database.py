from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

async_engine = None
async_session = None

if settings.database_url:
    try:
        async_engine = create_async_engine(settings.database_url, echo=False)
        async_session = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)
    except Exception:
        async_engine = None
        async_session = None


class Base(DeclarativeBase):
    pass


async def init_db():
    global async_engine
    if not settings.database_url or not async_engine:
        return
    try:
        async with async_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            try:
                await conn.execute(text("ALTER TABLE videos ADD COLUMN error_message TEXT;"))
            except Exception:
                pass
    except Exception as e:
        pass


async def probar_conexion_database(url: str) -> dict:
    if not url:
        return {"ok": False, "error": "La URL de la base de datos está vacía"}
    
    url = url.strip()
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://") and not url.startswith("postgresql+"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        
    try:
        test_engine = create_async_engine(url, echo=False)
        async with test_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            res = await conn.execute(text("SELECT COUNT(*) FROM videos;"))
            count = res.scalar() or 0
        await test_engine.dispose()
        return {"ok": True, "total_videos": count, "url": url}
    except Exception as e:
        return {"ok": False, "error": str(e)}


async def reconfigurar_database(nueva_url: str):
    global async_engine, async_session
    nueva_url = nueva_url.strip()
    if nueva_url.startswith("postgres://"):
        nueva_url = nueva_url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif nueva_url.startswith("postgresql://") and not nueva_url.startswith("postgresql+"):
        nueva_url = nueva_url.replace("postgresql://", "postgresql+asyncpg://", 1)
        
    settings.database_url = nueva_url
    async_engine = create_async_engine(settings.database_url, echo=False)
    async_session = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)
    await init_db()
