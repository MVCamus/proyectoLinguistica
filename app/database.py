from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

async_engine = create_async_engine(settings.database_url, echo=False)
async_session = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


from sqlalchemy import text

async def init_db():
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        try:
            await conn.execute(text("ALTER TABLE videos ADD COLUMN error_message TEXT;"))
        except Exception:
            pass
