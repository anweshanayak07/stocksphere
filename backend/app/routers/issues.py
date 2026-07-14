"""
/api/issues  –  stock-movement transactions (ISSUE & REPLENISH).

Endpoints:
  GET    /api/issues        → full history, newest first, with item_name joined
  POST   /api/issues        → create ISSUE or REPLENISH transaction
  PUT    /api/issues/{id}   → edit a transaction (adjusts item stock delta)
  DELETE /api/issues/{id}   → delete a transaction record (no stock reversal)

Business rules:
--------------------------------------------
ISSUE:     check stock → deduct item.quantity → insert Issues row
REPLENISH: add to item.quantity              → insert Issues row
PUT:       recalculate delta (old_qty - new_qty) → adjust item.quantity
"""

from datetime import datetime, timezone
from decimal import Decimal

import math
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app import models
from app.schemas import IssueCreate, IssueUpdate, IssueOut, PaginatedIssues

router = APIRouter(prefix="/api/issues", tags=["issues"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _to_issue_out(issue: models.Issue) -> IssueOut:
    """Map an ORM Issue (with joined Item) to the response schema."""
    return IssueOut(
        id=issue.id,
        item_id=issue.item_id,
        item_name=issue.item.name if issue.item else "",
        quantity=issue.quantity,
        issued_to=issue.issued_to,
        sap_notification=issue.sap_notification,
        note=issue.note,
        issue_date=issue.issue_date,
        type=issue.type,
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("", response_model=PaginatedIssues)
def list_issues(
    page:  int     = Query(default=1, ge=1),
    limit: int     = Query(default=20, ge=1, le=100),
    db:    Session = Depends(get_db)
):
    """
    Return paginated issue/replenish records ordered newest-first.
    The item name is joined in a single query (no N+1).
    """
    offset = (page - 1) * limit
    q = db.query(models.Issue).options(joinedload(models.Issue.item))
    total = q.count()
    issues = q.order_by(models.Issue.issue_date.desc()).offset(offset).limit(limit).all()

    return PaginatedIssues(
        page=page,
        limit=limit,
        total=total,
        totalPages=math.ceil(total / limit) if total else 1,
        data=[_to_issue_out(i) for i in issues]
    )


@router.post("", status_code=status.HTTP_201_CREATED)
def create_issue(body: IssueCreate, db: Session = Depends(get_db)):
    """
    Record a stock movement and adjust the item's quantity atomically.

    ISSUE     → deducts quantity (validates sufficient stock first)
    REPLENISH → adds quantity
    """
    item = db.get(models.Item, body.item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    qty = Decimal(str(body.quantity))

    if body.type == "ISSUE":
        if Decimal(str(item.quantity)) < qty:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Not enough stock available",
            )
        item.quantity = int(Decimal(str(item.quantity)) - qty)

    elif body.type == "REPLENISH":
        item.quantity = int(Decimal(str(item.quantity)) + qty)

    # Resolve issue_date: use provided value or default to now (UTC, tz-naive for DB)
    issue_date = body.issue_date
    if issue_date is None:
        issue_date = datetime.now(timezone.utc).replace(tzinfo=None)
    elif issue_date.tzinfo is not None:
        issue_date = issue_date.replace(tzinfo=None)

    new_issue = models.Issue(
        item_id=body.item_id,
        quantity=qty,
        issued_to=body.issued_to,
        sap_notification=body.sap_notification or "",
        note=body.note or "",
        issue_date=issue_date,
        type=body.type,
    )
    db.add(new_issue)
    db.commit()
    return {"message": "Transaction successful"}


@router.put("/{issue_id}")
def update_issue(issue_id: int, body: IssueUpdate, db: Session = Depends(get_db)):
    """
    Edit an existing issue record and reconcile the item's stock.

    The stock delta logic works as follows:
        qty_diff  = old_issue_qty - new_issue_qty
        item.qty += qty_diff
    (positive diff → stock goes up; negative diff → stock goes down)
    """
    issue = (
        db.query(models.Issue)
        .options(joinedload(models.Issue.item))
        .filter(models.Issue.id == issue_id)
        .first()
    )
    if not issue:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue record not found")

    new_qty  = Decimal(str(body.quantity))
    old_qty  = Decimal(str(issue.quantity))
    qty_diff = old_qty - new_qty          # positive → item gets stock back

    # Adjust item quantity
    item = issue.item
    item.quantity = int(Decimal(str(item.quantity)) + qty_diff)

    # Update issue fields
    issue.quantity         = new_qty
    issue.issued_to        = body.issued_to
    issue.sap_notification = body.sap_notification or ""
    issue.note             = body.note or ""

    if body.issue_date is not None:
        issue.issue_date = body.issue_date.replace(tzinfo=None)

    db.commit()
    return {"message": "Issue record updated successfully"}


@router.delete("/{issue_id}")
def delete_issue(issue_id: int, db: Session = Depends(get_db)):
    """
    Delete an issue record.
    Note: does NOT reverse the stock change.
    """
    issue = db.get(models.Issue, issue_id)
    if not issue:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue record not found")

    db.delete(issue)
    db.commit()
    return {"message": "Issue record deleted"}
