from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class AuthUser(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: EmailStr
    is_active: bool
    is_admin: bool
    preferred_language: str
    onboarding_complete: bool
    created_at: datetime


class ProfileUpdate(BaseModel):
    preferred_countries: list[str] | None = None
    preferred_sectors: list[str] | None = None
    target_opportunity_types: list[str] | None = None
    education_level: str | None = None
    current_status: str | None = None
    preferred_language: str | None = None
    onboarding_complete: bool | None = None


class UserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    preferred_countries_json: list[str]
    preferred_sectors_json: list[str]
    target_opportunity_types_json: list[str]
    education_level: str | None
    current_status: str | None
    preferred_language: str


class AuthResponse(BaseModel):
    user: AuthUser
    tokens: TokenPair
