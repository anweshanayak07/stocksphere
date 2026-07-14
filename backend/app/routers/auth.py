"""
/api/auth  –  login and register endpoints.

Endpoints:
  POST /api/auth/login     → { token, role }
  POST /api/auth/register  → { message }
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.schemas import LoginRequest, RegisterRequest, TokenResponse
from app.auth import verify_password, hash_password, create_access_token
from app.limiter import limiter

import os

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate a user and return a signed JWT.

    Raises
    ------
    404  if username does not exist
    401  if password is wrong
    """
    user = db.query(models.User).filter(models.User.username == body.username).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if not verify_password(body.password, user.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid password")

    token = create_access_token(user.id, user.role)
    return {"token": token, "role": user.role}


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    """
    Register a new user with role='user'.

    Raises
    ------
    400  if username already exists
    """
    existing = db.query(models.User).filter(models.User.username == body.username).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists",
        )

    new_user = models.User(
        username=body.username,
        password=hash_password(body.password),
        role="user",
    )
    db.add(new_user)
    db.commit()
    return {"message": "User registered successfully"}
