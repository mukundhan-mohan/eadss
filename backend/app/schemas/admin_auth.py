from pydantic import BaseModel
from datetime import datetime

class AdminLoginIn(BaseModel):
    email: str
    password: str

class AdminRegisterIn(BaseModel):
    email: str
    password: str

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
