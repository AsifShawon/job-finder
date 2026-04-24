from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import (
    TokenType,
    create_token,
    get_password_hash,
    token_hash,
    verify_password,
)
from app.models.entities import RefreshToken, User, UserProfile
from app.schemas.auth import AuthResponse, LoginRequest, RegisterRequest, TokenPair

settings = get_settings()


def _issue_tokens(db: Session, user: User) -> TokenPair:
    access_token = create_token(
        subject=str(user.id),
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
        token_type=TokenType.ACCESS,
    )
    refresh_token = create_token(
        subject=str(user.id),
        expires_delta=timedelta(days=settings.refresh_token_expire_days),
        token_type=TokenType.REFRESH,
    )
    refresh = RefreshToken(
        user_id=user.id,
        token_hash=token_hash(refresh_token),
        expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days),
    )
    db.add(refresh)
    db.commit()
    return TokenPair(access_token=access_token, refresh_token=refresh_token)


def register_user(db: Session, payload: RegisterRequest) -> AuthResponse:
    existing = db.scalar(select(User).where(User.email == payload.email.lower()))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        full_name=payload.full_name,
        email=payload.email.lower(),
        hashed_password=get_password_hash(payload.password),
    )
    db.add(user)
    db.flush()

    profile = UserProfile(user_id=user.id)
    db.add(profile)
    db.commit()
    db.refresh(user)
    return AuthResponse(user=user, tokens=_issue_tokens(db, user))


def login_user(db: Session, payload: LoginRequest) -> AuthResponse:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")
    return AuthResponse(user=user, tokens=_issue_tokens(db, user))


def refresh_user_tokens(db: Session, refresh_token: str) -> TokenPair:
    hashed = token_hash(refresh_token)
    record = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hashed, RefreshToken.revoked.is_(False)))
    if record is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    if record.expires_at < datetime.now(UTC):
        record.revoked = True
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired")

    user = db.scalar(select(User).where(User.id == record.user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    record.revoked = True
    db.commit()
    return _issue_tokens(db, user)


def logout_user(db: Session, refresh_token: str) -> None:
    hashed = token_hash(refresh_token)
    record = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hashed))
    if record is not None:
        record.revoked = True
        db.commit()
