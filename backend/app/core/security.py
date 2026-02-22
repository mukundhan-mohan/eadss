import hashlib
import os
from fastapi import Header, HTTPException, status, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models.api_key import ApiKey


def _hash_key(raw_key: str) -> str:
    pepper = os.getenv("API_KEY_PEPPER", "dev-pepper-change-me")
    return hashlib.sha256(f"{pepper}:{raw_key}".encode("utf-8")).hexdigest()


class ClientContext:
    def __init__(self, org_id: str, scopes: list[str] | None):
        self.org_id = org_id
        self.scopes = scopes or []

    def has_scope(self, scope: str) -> bool:
        return (not self.scopes) or (scope in self.scopes)


def require_api_key(
    db: Session = Depends(get_db),
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> ClientContext:
    if not x_api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing X-API-Key")

    key_hash = _hash_key(x_api_key)

    row = db.query(ApiKey).filter(ApiKey.key_hash == key_hash, ApiKey.is_active == True).first()  # noqa: E712
    if not row:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")

    return ClientContext(org_id=row.org_id, scopes=row.scopes)