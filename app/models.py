from datetime import datetime, timezone
from typing import Any

from sqlalchemy import DateTime, Integer, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Video(Base):
    __tablename__ = "videos"

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    username: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    hashtags: Mapped[list[Any] | None] = mapped_column(JSON)
    duration_sec: Mapped[int | None] = mapped_column(Integer)

    status: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="pendiente",
        index=True,
    )

    transcript_original: Mapped[list[Any] | None] = mapped_column(JSON)
    transcript_editada: Mapped[list[Any] | None] = mapped_column(JSON)
    drive_url: Mapped[str | None] = mapped_column(Text)

    corpus_number: Mapped[int | None] = mapped_column(Integer, index=True)

    shuffle_order: Mapped[int | None] = mapped_column(Integer, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    def __repr__(self) -> str:
        return f"<Video id={self.id!r} status={self.status!r}>"
