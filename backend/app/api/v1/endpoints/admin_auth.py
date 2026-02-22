from fastapi import APIRouter, Depends, Response, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models.admin_user import AdminUser
from app.db.models.admin_membership import AdminMembership
from app.db.models.api_key import ApiKey
from app.core.admin_auth import (
    verify_password,
    create_token,
    set_session_cookie,
    clear_session_cookie,
    require_admin,
    require_super_admin,
    hash_password,
)
from app.schemas.admin_auth import (
    AdminLoginIn,
    AdminRegisterIn,
    AdminMeOut,
    AdminMembershipOut,
    AdminApiKeyOut,
    SuperAdminUserOut,
)

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


@router.get("/super/users", response_model=list[SuperAdminUserOut])
def super_users(_: AdminUser = Depends(require_super_admin), db: Session = Depends(get_db)):
    users = db.query(AdminUser).order_by(AdminUser.created_at.desc()).all()
    memberships = db.query(AdminMembership).all()
    api_keys = db.query(ApiKey).all()

    memberships_by_user: dict[str, list[AdminMembershipOut]] = {}
    orgs_by_user: dict[str, set[str]] = {}
    for m in memberships:
        uid = str(m.admin_user_id)
        memberships_by_user.setdefault(uid, []).append(AdminMembershipOut(org_id=m.org_id, role=m.role))
        orgs_by_user.setdefault(uid, set()).add(m.org_id)

    keys_by_org: dict[str, list[AdminApiKeyOut]] = {}
    for k in api_keys:
        keys_by_org.setdefault(k.org_id, []).append(
            AdminApiKeyOut(
                org_id=k.org_id,
                name=k.name,
                key_hash=k.key_hash,
                is_active=k.is_active,
                created_at=k.created_at,
            )
        )

    out: list[SuperAdminUserOut] = []
    for u in users:
        uid = str(u.id)
        user_orgs = orgs_by_user.get(uid, set())
        user_keys: list[AdminApiKeyOut] = []
        for org_id in user_orgs:
            user_keys.extend(keys_by_org.get(org_id, []))

        out.append(
            SuperAdminUserOut(
                id=uid,
                email=u.email,
                is_active=u.is_active,
                is_super_admin=u.is_super_admin,
                created_at=u.created_at,
                password_hash=u.password_hash,
                memberships=memberships_by_user.get(uid, []),
                api_keys=user_keys,
            )
        )

    return out
