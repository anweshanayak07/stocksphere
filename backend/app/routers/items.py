"""
/api/items  –  full CRUD + search/filter/pagination + filter-option helpers.

  GET  /api/items/locations   → list of distinct location strings
  GET  /api/items/categories  → list of distinct category strings
  GET  /api/items             → paginated + filtered item list
  POST /api/items             → create item  (admin only)
  PUT  /api/items/{id}        → update item  (admin only)
  DELETE /api/items/{id}      → delete item  (admin only)
"""

import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.schemas import ItemCreate, ItemUpdate, ItemOut, PaginatedItems
from app.auth import require_admin

router = APIRouter(prefix="/api/items", tags=["items"])


# ---------------------------------------------------------------------------
# Filter-option helpers  (called by frontend dropdowns on mount)
# ---------------------------------------------------------------------------

@router.get("/locations", response_model=list[str])
def get_locations(db: Session = Depends(get_db)):
    """Return all distinct, non-empty locations sorted alphabetically."""
    rows = (
        db.query(models.Item.location)
        .filter(models.Item.location.isnot(None), models.Item.location != "")
        .distinct()
        .order_by(models.Item.location)
        .all()
    )
    return [r.location for r in rows]


@router.get("/categories", response_model=list[str])
def get_categories(db: Session = Depends(get_db)):
    """Return all distinct, non-empty categories sorted alphabetically."""
    rows = (
        db.query(models.Item.category)
        .filter(models.Item.category.isnot(None), models.Item.category != "")
        .distinct()
        .order_by(models.Item.category)
        .all()
    )
    return [r.category for r in rows]


# ---------------------------------------------------------------------------
# Paginated list with search + filters
# ---------------------------------------------------------------------------

@router.get("", response_model=PaginatedItems)
def list_items(
    page:     int            = Query(default=1,  ge=1),
    limit:    int            = Query(default=20, ge=1, le=200),
    search:   str            = Query(default=""),
    category: Optional[str]  = Query(default=None),
    location: Optional[str]  = Query(default=None),
    status:   Optional[str]  = Query(default=None),   # in_stock | low_stock | out_of_stock
    db:       Session        = Depends(get_db),
):
    """
    Search and filter items with pagination.

    Search matches against: name, location, category, make, material_code.
    Status filter logic mirrors the JS ISNULL(min_quantity, 0) behaviour.
    """
    offset = (page - 1) * limit
    pattern = f"%{search}%"

    q = db.query(models.Item)

    # Full-text-style search across key columns
    q = q.filter(
        or_(
            models.Item.name.ilike(pattern),
            models.Item.location.ilike(pattern),
            models.Item.category.ilike(pattern),
            models.Item.make.ilike(pattern),
            models.Item.material_code.ilike(pattern),
        )
    )

    # Exact filters
    if category and category != "All":
        q = q.filter(models.Item.category == category)

    if location and location != "All":
        q = q.filter(models.Item.location == location)

    # Stock-status filter
    if status and status != "All":
        if status == "out_of_stock":
            q = q.filter(models.Item.quantity == 0)
        elif status == "low_stock":
            q = q.filter(
                models.Item.quantity > 0,
                models.Item.quantity <= func.coalesce(models.Item.min_quantity, 0),
            )
        elif status == "in_stock":
            q = q.filter(
                models.Item.quantity > func.coalesce(models.Item.min_quantity, 0)
            )

    total = q.count()
    items = q.order_by(models.Item.id.desc()).offset(offset).limit(limit).all()

    return PaginatedItems(
        page=page,
        limit=limit,
        total=total,
        totalPages=math.ceil(total / limit) if total else 1,
        data=items,
    )


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

@router.post("", status_code=status.HTTP_201_CREATED)
def create_item(
    body: ItemCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """Add a new inventory item."""
    item = models.Item(**body.model_dump())
    db.add(item)
    db.commit()
    return {"message": "Item added successfully"}


@router.put("/{item_id}")
def update_item(
    item_id: int,
    body: ItemUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """Update all fields of an existing item."""
    item = db.get(models.Item, item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    for field, value in body.model_dump().items():
        setattr(item, field, value)

    db.commit()
    return {"message": "Item updated"}


@router.delete("/{item_id}")
def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """Permanently delete an item (cascades to its issue records)."""
    item = db.get(models.Item, item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    db.delete(item)
    db.commit()
    return {"message": "Item deleted"}
