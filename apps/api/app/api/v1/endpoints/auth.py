from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.entities import User, UserProfile
from app.schemas.auth import (
    AuthResponse,
    AuthUser,
    LoginRequest,
    ProfileUpdate,
    RefreshRequest,
    RegisterRequest,
    TokenPair,
    UserProfileResponse,
)
from app.schemas.common import MessageResponse
from app.services.auth_service import login_user, logout_user, refresh_user_tokens, register_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> AuthResponse:
    return register_user(db, payload)


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> AuthResponse:
    return login_user(db, payload)


@router.post("/refresh", response_model=TokenPair)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)) -> TokenPair:
    return refresh_user_tokens(db, payload.refresh_token)


@router.post("/logout", response_model=MessageResponse)
def logout(payload: RefreshRequest, db: Session = Depends(get_db)) -> MessageResponse:
    logout_user(db, payload.refresh_token)
    return MessageResponse(message="Logged out")


@router.get("/me", response_model=AuthUser)
def me(user: User = Depends(get_current_user)) -> AuthUser:
    return user


@router.get("/profile", response_model=UserProfileResponse)
def get_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> UserProfileResponse:
    profile = db.scalar(select(UserProfile).where(UserProfile.user_id == user.id))
    if profile is None:
        profile = UserProfile(user_id=user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return UserProfileResponse(
        preferred_countries_json=profile.preferred_countries_json or [],
        preferred_sectors_json=profile.preferred_sectors_json or [],
        target_opportunity_types_json=profile.target_opportunity_types_json or [],
        education_level=profile.education_level,
        current_status=profile.current_status,
        preferred_language=user.preferred_language,
    )


@router.patch("/profile", response_model=AuthUser)
def update_profile(
    payload: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AuthUser:
    profile = db.scalar(select(UserProfile).where(UserProfile.user_id == user.id))
    if profile is None:
        profile = UserProfile(user_id=user.id)
        db.add(profile)

    if payload.preferred_countries is not None:
        profile.preferred_countries_json = payload.preferred_countries
    if payload.preferred_sectors is not None:
        profile.preferred_sectors_json = payload.preferred_sectors
    if payload.target_opportunity_types is not None:
        profile.target_opportunity_types_json = payload.target_opportunity_types
    if payload.education_level is not None:
        profile.education_level = payload.education_level
    if payload.current_status is not None:
        profile.current_status = payload.current_status
    if payload.preferred_language is not None:
        user.preferred_language = payload.preferred_language
    if payload.onboarding_complete is True:
        user.onboarding_complete = True

    db.commit()
    db.refresh(user)
    return user
