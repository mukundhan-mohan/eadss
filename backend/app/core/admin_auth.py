import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from passlib.context import CryptContext
from fastapi import Cookie, HTTPException, status, Response, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models.admin_user import AdminUser

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

JWT_SECRET = os.getenv("ADMIN_JWT_SECRET", "dev-admin-secret-change-me")
JWT_ALG = "HS256"
COOKIE_NAME = "eadss_admin_session"
COOKIE_MAX_AGE = 60 * 60 * 24 * 7  # 7 days


def hash_password(pw: str) -> str:
    return pwd_context.hash(pw)

def verify_password(pw: str, pw_hash: str) -> bool:
    return pwd_context.verify(pw, pw_hash)

def create_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": user_id, "iat": int(now.timestamp()), "exp": int((now + timedelta(seconds=COOKIE_MAX_AGE)).timestamp())}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def read_token(token: str) -> str:
    payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    return str(payload["sub"])


def set_session_cookie(resp: Response, token: str):
    resp.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=False,     # set True behind HTTPS
        samesite="lax",
        max_age=COOKIE_MAX_AGE,
        path="/",
    )

def clear_session_cookie(resp: Response):
    resp.delete_cookie(COOKIE_NAME, path="/")


def require_admin(
    db: Session = Depends(get_db),
    eadss_admin_session: Optional[str] = Cookie(default=None, alias=COOKIE_NAME),
) -> AdminUser:
    if not eadss_admin_session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not logged in")

    try:
        user_id = read_token(eadss_admin_session)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")

    user = db.get(AdminUser, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not logged in")
    return user


def require_super_admin(user: AdminUser = Depends(require_admin)) -> AdminUser:
    if not user.is_super_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super admin access required")
    return user
