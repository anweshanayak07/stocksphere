"""
SQLAlchemy ORM models — mirrors the MSSQL schema exactly so the
frontend business logic requires zero changes.

Tables
------
users   – authentication
items   – inventory items
issues  – issue / replenish transactions (FK → items)
"""

from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Text, Numeric, DateTime,
    ForeignKey, func
)
from sqlalchemy.orm import relationship
from app.database import Base


class User(Base):
    """
    Stores login credentials and role.

    Roles
    -----
    admin  – full CRUD access
    user   – read + issue/replenish only (enforced on the frontend)
    """
    __tablename__ = "users"

    id         = Column(Integer, primary_key=True, index=True)
    username   = Column(String(100), unique=True, nullable=False, index=True)
    password   = Column(String(255), nullable=False)          # bcrypt hash
    role       = Column(String(20), nullable=False, default="user")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Item(Base):
    """
    A single inventory item (spare part, consumable, etc.).

    quantity     – current stock level; adjusted automatically by Issue/Replenish
    min_quantity – threshold below which the item is considered "low stock"
    """
    __tablename__ = "items"

    id            = Column(Integer, primary_key=True, index=True)
    name          = Column(String(255), nullable=False)
    quantity      = Column(Integer, nullable=False, default=0)
    location      = Column(String(255), nullable=True)
    category      = Column(String(100), nullable=True)
    make          = Column(String(255), nullable=True, default="")
    material_code = Column(String(100), nullable=True, default="")
    min_quantity  = Column(Integer, nullable=False, default=0)

    # Back-reference: all transactions for this item
    issues = relationship("Issue", back_populates="item", cascade="all, delete-orphan")


class Issue(Base):
    """
    Records every stock movement:
      type='ISSUE'     → quantity deducted from Item.quantity
      type='REPLENISH' → quantity added   to   Item.quantity

    The item's stock is updated atomically in the same DB transaction as
    the Issue row insertion (handled in the router layer).
    """
    __tablename__ = "issues"

    id               = Column(Integer, primary_key=True, index=True)
    item_id          = Column(Integer, ForeignKey("items.id"), nullable=False, index=True)
    quantity         = Column(Numeric(10, 2), nullable=False)
    issued_to        = Column(String(255), nullable=False)
    sap_notification = Column(String(255), nullable=True, default="")
    note             = Column(Text, nullable=True, default="")
    issue_date       = Column(
        DateTime(timezone=False),
        nullable=True,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        index=True
    )
    type             = Column(String(20), nullable=False, default="ISSUE")  # ISSUE | REPLENISH

    # Eager relationship: lets us do issue.item.name without extra queries
    item = relationship("Item", back_populates="issues")
