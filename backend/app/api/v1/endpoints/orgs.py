from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models.org import Organization
from app.db.models.api_key import ApiKey
from app.core.security import _hash_key
from app.core.admin_auth import require_admin
from app.db.models.admin_membership import AdminMembership
from app.schemas.orgs import OrgRegisterIn, OrgRegisterOut

import secrets

router = APIRouter(prefix="/orgs")

@router.post("/register")
def register_org(payload: OrgRegisterIn, db: Session = Depends(get_db), admin=Depends(require_admin)) -> OrgRegisterOut:
    existing = db.query(Organization).filter(Organization.org_id == payload.org_id).first()
    if existing:
        raise HTTPException(409, "org_id already exists")

    org = Organization(org_id=payload.org_id, name=payload.name)
    db.add(org)

    # link admin to this org
    db.add(AdminMembership(admin_user_id=admin.id, org_id=payload.org_id, role="admin"))

    # generate API key (plaintext returned once)
    raw_key = f"eadss_{secrets.token_urlsafe(24)}"
    key_hash = _hash_key(raw_key)

    db.add(ApiKey(
        key_hash=key_hash,
        org_id=payload.org_id,
        name="primary",
        scopes=["read:documents","read:tickets","write:ingest","read:alerts","read:usage"],
        is_active=True,
    ))

    db.commit()
    return {"org_id": payload.org_id, "name": payload.name, "api_key": raw_key}
