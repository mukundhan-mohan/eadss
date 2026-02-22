from fastapi import APIRouter, Depends, Response, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models.admin_user import AdminUser
from app.core.admin_auth import (
    verify_password,
    create_token,
    set_session_cookie,
    clear_session_cookie,
    require_admin,
    require_super_admin,
    hash_password,
)
from app.schemas.admin_auth import AdminLoginIn, AdminRegisterIn, AdminMeOut

router = APIRouter(prefix="/admin")

@router.post("/register", response_model=AdminMeOut)
def register(payload: AdminRegisterIn, resp: Response, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    existing = db.query(AdminUser).filter(AdminUser.email == email).first()
    if existing:
        raise HTTPException(409, "Email already registered")

    user = AdminUser(email=email, password_hash=hash_password(payload.password), is_active=True, is_super_admin=False)
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_token(str(user.id))
    set_session_cookie(resp, token)
    return AdminMeOut(id=str(user.id), email=user.email, is_super_admin=user.is_super_admin)

@router.post("/login", response_model=AdminMeOut)
def login(payload: AdminLoginIn, resp: Response, db: Session = Depends(get_db)):
    user = db.query(AdminUser).filter(AdminUser.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")
    token = create_token(str(user.id))
    set_session_cookie(resp, token)
    return AdminMeOut(id=str(user.id), email=user.email, is_super_admin=user.is_super_admin)


@router.post("/super/login", response_model=AdminMeOut)
def super_login(payload: AdminLoginIn, resp: Response, db: Session = Depends(get_db)):
    user = db.query(AdminUser).filter(AdminUser.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")
    if not user.is_super_admin:
        raise HTTPException(403, "Super admin access required")
    token = create_token(str(user.id))
    set_session_cookie(resp, token)
    return AdminMeOut(id=str(user.id), email=user.email, is_super_admin=user.is_super_admin)

@router.post("/logout")
def logout(resp: Response):
    clear_session_cookie(resp)
    return {"ok": True}

@router.get("/me", response_model=AdminMeOut)
def me(user: AdminUser = Depends(require_admin)):
    return AdminMeOut(id=str(user.id), email=user.email, is_super_admin=user.is_super_admin)


@router.get("/super/me", response_model=AdminMeOut)
def super_me(user: AdminUser = Depends(require_super_admin)):
    return AdminMeOut(id=str(user.id), email=user.email, is_super_admin=user.is_super_admin)
