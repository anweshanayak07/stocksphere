"""
Pydantic schemas — request bodies and response shapes.

Each domain has:
  *Base    – shared fields
  *Create  – fields accepted when creating a record
  *Update  – fields accepted when updating a record
  *Out     – fields returned to the client (never exposes passwords etc.)
"""

from __future__ import annotations
from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator, computed_field


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6)


class TokenResponse(BaseModel):
    token: str
    role: str


# ---------------------------------------------------------------------------
# Items
# ---------------------------------------------------------------------------

class ItemBase(BaseModel):
    name:          str
    quantity:      int   = Field(ge=0)
    location:      Optional[str] = None
    category:      Optional[str] = None
    make:          Optional[str] = ""
    material_code: Optional[str] = ""
    min_quantity:  int   = Field(default=0, ge=0)


class ItemCreate(ItemBase):
    """Body for POST /api/items"""
    pass


class ItemUpdate(ItemBase):
    """Body for PUT /api/items/{id}"""
    pass


class ItemOut(ItemBase):
    """Response schema — includes the DB-generated id."""
    id: int

    model_config = {"from_attributes": True}


class PaginatedItems(BaseModel):
    """Paginated list of items — matches the existing JS response shape."""
    page:       int
    limit:      int
    total:      int
    totalPages: int
    data:       List[ItemOut]


# ---------------------------------------------------------------------------
# Issues / Transactions
# ---------------------------------------------------------------------------

class IssueCreate(BaseModel):
    """Body for POST /api/issues (both ISSUE and REPLENISH)."""
    item_id:          int
    quantity:         Decimal = Field(gt=0)
    issued_to:        str
    sap_notification: Optional[str] = ""
    note:             Optional[str] = ""
    issue_date:       Optional[datetime] = None
    type:             str = "ISSUE"          # "ISSUE" | "REPLENISH"

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        v = v.upper()
        if v not in {"ISSUE", "REPLENISH"}:
            raise ValueError("type must be ISSUE or REPLENISH")
        return v


class IssueUpdate(BaseModel):
    """Body for PUT /api/issues/{id}  (only editable fields)."""
    quantity:         Decimal = Field(gt=0)
    issued_to:        str
    sap_notification: Optional[str] = ""
    note:             Optional[str] = ""
    issue_date:       Optional[datetime] = None


class IssueOut(BaseModel):
    """Response schema — flattens item_name for the frontend table."""
    id:               int
    item_id:          int
    item_name:        str        # denormalised from the joined Item row
    quantity:         int        # returned as whole number, never decimal
    issued_to:        str
    sap_notification: Optional[str]
    note:             Optional[str]
    issue_date:       Optional[datetime]
    type:             str

    @field_validator("quantity", mode="before")
    @classmethod
    def coerce_quantity_to_int(cls, v) -> int:
        """Ensure quantity is always returned as an integer."""
        return int(Decimal(str(v)))

    model_config = {"from_attributes": True}


class PaginatedIssues(BaseModel):
    """Paginated list of issues."""
    page:       int
    limit:      int
    total:      int
    totalPages: int
    data:       List[IssueOut]


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

class DashboardStats(BaseModel):
    """Response for GET /api/dashboard/stats"""
    totalItems:  int
    lowStock:    int
    itemsIssued: int
