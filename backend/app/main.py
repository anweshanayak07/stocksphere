"""
FastAPI application entry point.

- Creates all DB tables on startup (idempotent via CREATE IF NOT EXISTS)
- Mounts CORS allowing the React dev server (origin: http://localhost:3000)
- Registers all routers under /api prefix
- Runs on PORT 5000 so the React frontend requires no configuration changes
"""

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base, SessionLocal
from app.config import settings
from app.logger import logger

# Import models so that Base.metadata knows about all tables before create_all
from app import models  # noqa: F401
from app.auth import hash_password

# Routers
from app.routers import auth, items, issues, dashboard

from app.limiter import limiter
from contextlib import asynccontextmanager
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

# ---------------------------------------------------------------------------
# Lifespan Events (Database seeding on startup)
# ---------------------------------------------------------------------------

def seed_data():
    """Seed default data (safe to run repeatedly)."""
    logger.info("Starting application backend and running startup checks.")

    # Seed default data
    db = SessionLocal()
    try:
        # Seed default admin user if users table is empty
        if db.query(models.User).count() == 0:
            admin_user = models.User(
                username="admin",
                password=hash_password("vectra"),
                role="admin"
            )
            db.add(admin_user)
            db.commit()
            logger.info("Seeded default admin user (admin/vectra).")

        # Seed default items if items table is empty
        if db.query(models.Item).count() == 0:
            default_items = [
                models.Item(
                    name="Cat5e RJ45 Connector",
                    quantity=120,
                    location="Rack-B1",
                    category="Connector",
                    make="AMP",
                    material_code="MC-001",
                    min_quantity=50
                ),
                models.Item(
                    name="Unshielded Twisted Pair Cable Cat6",
                    quantity=5,
                    location="Warehouse A",
                    category="Cable",
                    make="Schneider",
                    material_code="MC-002",
                    min_quantity=10
                ),
                models.Item(
                    name="Proximity Sensor Autonics",
                    quantity=15,
                    location="Store-A1",
                    category="Sensor",
                    make="Autonics",
                    material_code="MC-003",
                    min_quantity=8
                ),
                models.Item(
                    name="Siemens PLC S7-1200",
                    quantity=2,
                    location="Store-F2",
                    category="Control",
                    make="Siemens",
                    material_code="MC-004",
                    min_quantity=3
                ),
                models.Item(
                    name="General Purpose Relay 24VDC",
                    quantity=45,
                    location="Rack-C2",
                    category="Switch",
                    make="Omron",
                    material_code="MC-005",
                    min_quantity=20
                )
            ]
            db.add_all(default_items)
            db.commit()
            logger.info("Seeded default items.")
    except Exception as e:
        logger.error(f"Seeding failed: {e}")
        db.rollback()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    seed_data()
    yield


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

app = FastAPI(
    title="StockSphere Inventory API",
    description="Python/FastAPI backend for StockSphere Inventory Management system.",
    version="2.0.0",
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://stocksphere-one.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(auth.router)
app.include_router(items.router)
app.include_router(issues.router)
app.include_router(dashboard.router)


# ---------------------------------------------------------------------------
# Health-check
# ---------------------------------------------------------------------------

@app.get("/")
def root():
    return {"message": "Backend is running!"}


# ---------------------------------------------------------------------------
# Dev server entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.port, reload=True)
