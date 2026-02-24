import re
from pydantic import BaseModel, field_validator
from datetime import datetime

class AdminLoginIn(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        value = v.strip().lower()
        if not re.match(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$", value):
            raise ValueError("Enter a valid email address")
        return value

class AdminRegisterIn(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        value = v.strip().lower()
        if not re.match(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$", value):
            raise ValueError("Enter a valid email address")
        return value

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must include at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must include at least one lowercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must include at least one number")
        if not re.search(r"[^A-Za-z0-9]", v):
            raise ValueError("Password must include at least one special character")
        return v

class AdminMeOut(BaseModel):
    id: str
    email: str
    is_super_admin: bool


class AdminMembershipOut(BaseModel):
    org_id: str
    role: str


class AdminApiKeyOut(BaseModel):
    org_id: str
    name: str | None = None
    key_hash: str
    is_active: bool
    created_at: datetime


class SuperAdminUserOut(BaseModel):
    id: str
    email: str
    is_active: bool
    is_super_admin: bool
    created_at: datetime
    password_hash: str
    memberships: list[AdminMembershipOut]
    api_keys: list[AdminApiKeyOut]
