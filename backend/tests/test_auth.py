"""Tests for POST /api/auth/login and POST /api/auth/register."""

from app import models
from app.auth import hash_password


# ---------------------------------------------------------------------------
# Login tests
# ---------------------------------------------------------------------------

def test_login_success(client, db):
    """Valid credentials return a JWT token and role."""
    db.add(models.User(username="login_user", password=hash_password("secret"), role="user"))
    db.commit()

    resp = client.post("/api/auth/login", json={"username": "login_user", "password": "secret"})
    assert resp.status_code == 200
    data = resp.json()
    assert "token" in data
    assert data["role"] == "user"


def test_login_wrong_password(client, db):
    """Wrong password returns HTTP 401."""
    db.add(models.User(username="pw_user", password=hash_password("correct"), role="user"))
    db.commit()

    resp = client.post("/api/auth/login", json={"username": "pw_user", "password": "wrong"})
    assert resp.status_code == 401


def test_login_unknown_user(client):
    """Non-existent username returns HTTP 404."""
    resp = client.post("/api/auth/login", json={"username": "nobody", "password": "x"})
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Register tests
# ---------------------------------------------------------------------------

def test_register_success(client):
    """New user registers and receives a success message."""
    resp = client.post("/api/auth/register", json={"username": "new_reg_user", "password": "pass123"})
    assert resp.status_code == 201
    assert "message" in resp.json()


def test_register_duplicate(client, db):
    """Registering an existing username returns HTTP 400."""
    db.add(models.User(username="dup_user", password=hash_password("abcdef"), role="user"))
    db.commit()

    resp = client.post("/api/auth/register", json={"username": "dup_user", "password": "xyz123"})
    assert resp.status_code == 400
