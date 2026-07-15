import uuid

from sqlalchemy import Enum as SAEnum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDMixin
from app.models.enums import DesignSource, DesignType


class Design(UUIDMixin, TimestampMixin, Base):
    """Artwork applied to a BaseItem. PERSONAL (upload/AI) or PAID (from a collab)."""

    __tablename__ = "designs"

    owner_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    type: Mapped[DesignType] = mapped_column(SAEnum(DesignType))
    source: Mapped[DesignSource] = mapped_column(SAEnum(DesignSource), default=DesignSource.UPLOAD)
    resource_url: Mapped[str] = mapped_column(String)  # 🔌 file storage
