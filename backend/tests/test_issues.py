"""Tests for /api/issues – issue/replenish transactions."""

from app import models
from app.auth import hash_password


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------

def test_list_issues(client):
    """GET /api/issues returns a paginated structure."""
    resp = client.get("/api/issues")
    assert resp.status_code == 200
    data = resp.json()
    assert "data" in data
    assert isinstance(data["data"], list)
    assert "total" in data
    assert "page" in data
    assert "limit" in data


# ---------------------------------------------------------------------------
# Create issue / replenish
# ---------------------------------------------------------------------------

def test_create_issue(client, sample_item):
    """Issuing stock deducts from item quantity."""
    initial_qty = sample_item.quantity

    resp = client.post("/api/issues", json={
        "item_id": sample_item.id,
        "quantity": 10,
        "issued_to": "Tech Lab",
        "type": "ISSUE",
    })
    assert resp.status_code == 201

    # Verify item quantity was decremented
    from app import models as m
    from sqlalchemy.orm import Session
    # Re-query via a raw SQL to not re-use the cached fixture object
    resp2 = client.get(f"/api/items?search={sample_item.name}")
    updated_qty = resp2.json()["data"][0]["quantity"]
    assert updated_qty == initial_qty - 10


def test_create_replenish(client, sample_item):
    """Replenishing stock adds to item quantity."""
    initial_qty = sample_item.quantity

    resp = client.post("/api/issues", json={
        "item_id": sample_item.id,
        "quantity": 20,
        "issued_to": "Warehouse",
        "type": "REPLENISH",
    })
    assert resp.status_code == 201

    resp2 = client.get(f"/api/items?search={sample_item.name}")
    updated_qty = resp2.json()["data"][0]["quantity"]
    assert updated_qty == initial_qty + 20


def test_create_issue_insufficient_stock(client, sample_item):
    """Issuing more than available stock returns 400."""
    resp = client.post("/api/issues", json={
        "item_id": sample_item.id,
        "quantity": sample_item.quantity + 1000,
        "issued_to": "Nobody",
        "type": "ISSUE",
    })
    assert resp.status_code == 400


def test_create_issue_invalid_item(client):
    """Issuing stock for a non-existent item returns 404."""
    resp = client.post("/api/issues", json={
        "item_id": 999999,
        "quantity": 1,
        "issued_to": "Test",
        "type": "ISSUE",
    })
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Update issue
# ---------------------------------------------------------------------------

def test_update_issue(client, db, sample_item):
    """Updating an issue adjusts the item stock delta correctly."""
    from app import models

    # First, create an issue record manually
    issue = models.Issue(
        item_id=sample_item.id,
        quantity=10,
        issued_to="Lab",
        sap_notification="",
        note="",
        type="ISSUE",
    )
    db.add(issue)
    sample_item.quantity -= 10
    db.commit()
    db.refresh(issue)
    db.refresh(sample_item)

    qty_before = sample_item.quantity

    # Now update: change quantity from 10 -> 5 (should give back 5 units)
    resp = client.put(f"/api/issues/{issue.id}", json={
        "quantity": 5,
        "issued_to": "Lab",
        "sap_notification": "",
        "note": "",
    })
    assert resp.status_code == 200

    resp2 = client.get(f"/api/items?search={sample_item.name}")
    updated_qty = resp2.json()["data"][0]["quantity"]
    assert updated_qty == qty_before + 5  # got 5 units back


# ---------------------------------------------------------------------------
# Delete issue
# ---------------------------------------------------------------------------

def test_delete_issue(client, db, sample_item):
    """Deleting an issue record removes it (no stock reversal)."""
    from app import models

    issue = models.Issue(
        item_id=sample_item.id,
        quantity=5,
        issued_to="Lab",
        sap_notification="",
        note="",
        type="ISSUE",
    )
    db.add(issue)
    db.commit()
    db.refresh(issue)

    resp = client.delete(f"/api/issues/{issue.id}")
    assert resp.status_code == 200
    assert "message" in resp.json()


def test_delete_issue_not_found(client):
    """Deleting a non-existent issue returns 404."""
    resp = client.delete("/api/issues/999999")
    assert resp.status_code == 404
