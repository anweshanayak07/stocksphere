"""
conftest.py – Pytest fixtures shared across all test modules.

Uses an in-memory SQLite database so tests never touch the real PostgreSQL
instance. Each test runs inside a transaction that is rolled back after the
test completes, keeping tests isolated from each other.
"""

import os
os.environ["TESTING"] = "1"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db
from app import models
from app.auth import hash_password

# ---------------------------------------------------------------------------
# In-memory SQLite engine for tests (no real DB needed)
# ---------------------------------------------------------------------------

TEST_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    """Create all tables once before any test, drop them after the session."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db():
    """Yield a transactional DB session; rollback after each test."""
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture()
def client(db):
    """FastAPI test client that uses the test DB session."""
    import os
    os.environ["TESTING"] = "1"
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    os.environ.pop("TESTING", None)


@pytest.fixture()
def admin_token(client, db):
    """Return a valid JWT for the seeded admin user, creating one if needed."""
    # Ensure admin user exists
    existing = db.query(models.User).filter_by(username="test_admin").first()
    if not existing:
        user = models.User(username="test_admin", password=hash_password("testpass"), role="admin")
        db.add(user)
        db.commit()

    resp = client.post("/api/auth/login", json={"username": "test_admin", "password": "testpass"})
    assert resp.status_code == 200, f"Admin login failed: {resp.json()}"
    return resp.json()["token"]


@pytest.fixture()
def user_token(client, db):
    """Return a valid JWT for a regular user, creating one if needed."""
    existing = db.query(models.User).filter_by(username="test_user").first()
    if not existing:
        user = models.User(username="test_user", password=hash_password("testpass"), role="user")
        db.add(user)
        db.commit()

    resp = client.post("/api/auth/login", json={"username": "test_user", "password": "testpass"})
    assert resp.status_code == 200, f"User login failed: {resp.json()}"
    return resp.json()["token"]


@pytest.fixture()
def sample_item(db):
    """Create and return a sample Item in the test DB."""
    item = models.Item(
        name="Test Widget",
        quantity=100,
        location="Shelf-1",
        category="Test",
        make="Acme",
        material_code="TW-001",
        min_quantity=10,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item
