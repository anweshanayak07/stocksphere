"""
/api/dashboard/stats  –  summary counts for the dashboard header cards.

  GET /api/dashboard/stats → { totalItems, lowStock, itemsIssued }

All three values are computed in separate queries but within a single DB session for consistency.
"""

from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.schemas import DashboardStats

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
def get_stats(db: Session = Depends(get_db)):
    """
    Return three aggregate stats for the dashboard.

    totalItems  – total distinct item rows in Items table
    lowStock    – items where quantity < 10
    itemsIssued – sum of quantity across all Issues rows
    """
    total_items: int = db.query(func.count(models.Item.id)).scalar() or 0

    low_stock: int = (
        db.query(func.count(models.Item.id))
        .filter(
            models.Item.quantity > 0,
            models.Item.quantity <= func.coalesce(models.Item.min_quantity, 0)
        )
        .scalar()
        or 0
    )

    items_issued = int(
        db.query(func.sum(models.Issue.quantity))
        .scalar()
        or 0
    )

    return DashboardStats(
        totalItems=total_items,
        lowStock=low_stock,
        itemsIssued=items_issued,
    )

