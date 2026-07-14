"""Tests for /api/items – CRUD, pagination, search, filter helpers."""


# ---------------------------------------------------------------------------
# Filter helpers
# ---------------------------------------------------------------------------

def test_get_locations(client, sample_item):
    """GET /api/items/locations returns a list of location strings."""
    resp = client.get("/api/items/locations")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert "Shelf-1" in resp.json()


def test_get_categories(client, sample_item):
    """GET /api/items/categories returns a list of category strings."""
    resp = client.get("/api/items/categories")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert "Test" in resp.json()


# ---------------------------------------------------------------------------
# Paginated list
# ---------------------------------------------------------------------------

def test_list_items(client, sample_item):
    """GET /api/items returns paginated response with correct keys."""
    resp = client.get("/api/items")
    assert resp.status_code == 200
    data = resp.json()
    assert "data" in data
    assert "total" in data
    assert "page" in data


def test_list_items_search(client, sample_item):
    """Search by name filters items correctly."""
    resp = client.get("/api/items?search=Test Widget")
    assert resp.status_code == 200
    items = resp.json()["data"]
    assert any(i["name"] == "Test Widget" for i in items)


def test_list_items_no_results(client, sample_item):
    """Search for non-existent term returns empty data list."""
    resp = client.get("/api/items?search=ZZZZNONEXISTENT")
    assert resp.status_code == 200
    assert resp.json()["total"] == 0


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

def test_create_item(client, admin_token):
    """Admin can create a new item."""
    resp = client.post(
        "/api/items",
        json={"name": "New Part", "quantity": 50, "location": "Shelf-2",
              "category": "Widget", "make": "Acme", "material_code": "NP-001", "min_quantity": 5},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 201
    assert "message" in resp.json()


def test_create_item_unauthorized(client):
    """Unauthenticated user cannot create items."""
    resp = client.post(
        "/api/items",
        json={"name": "Fake", "quantity": 1, "location": "X", "category": "Y",
              "make": "", "material_code": "", "min_quantity": 0},
    )
    assert resp.status_code == 401


def test_create_item_non_admin(client, user_token):
    """Regular (non-admin) user cannot create items."""
    resp = client.post(
        "/api/items",
        json={"name": "Fake", "quantity": 1, "location": "X", "category": "Y",
              "make": "", "material_code": "", "min_quantity": 0},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert resp.status_code == 403


def test_update_item(client, admin_token, sample_item):
    """Admin can update an existing item."""
    resp = client.put(
        f"/api/items/{sample_item.id}",
        json={"name": "Updated Widget", "quantity": 200, "location": "Shelf-1",
              "category": "Test", "make": "Acme", "material_code": "TW-001", "min_quantity": 10},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    assert "message" in resp.json()


def test_update_item_not_found(client, admin_token):
    """Update for non-existent item returns 404."""
    resp = client.put(
        "/api/items/999999",
        json={"name": "Ghost", "quantity": 0, "location": "X",
              "category": "Y", "make": "", "material_code": "", "min_quantity": 0},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 404


def test_delete_item(client, admin_token, sample_item):
    """Admin can delete an existing item."""
    resp = client.delete(
        f"/api/items/{sample_item.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    assert "message" in resp.json()


def test_delete_item_not_found(client, admin_token):
    """Delete for non-existent item returns 404."""
    resp = client.delete(
        "/api/items/999999",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 404
