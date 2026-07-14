"""
SQLAlchemy engine, session factory, and declarative Base.
All models import Base from here.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import settings

# echo=True prints every SQL statement – handy for debugging; set to False in prod
engine = create_engine(settings.database_url, echo=False, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""
    pass


def get_db():
    """
    FastAPI dependency that yields a database session and ensures it is
    closed when the request is done (even on error).
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
