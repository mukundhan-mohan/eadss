from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.router import api_router
import time
import os
from starlette.middleware.base import BaseHTTPMiddleware
from app.db.session import SessionLocal
from app.db.models.usage import UsageEvent

app = FastAPI(title="EADSS API")

default_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://app.eadss.com",
    "https://eadss.com",
    "https://www.eadss.com",
]
env_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
allow_origins = env_origins or default_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class UsageMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        start = time.time()
        response = await call_next(request)
        ms = int((time.time() - start) * 1000)

        # derive org_id from API key header if present (best-effort)
        org_id = None
        api_key = request.headers.get("X-API-Key")
        if api_key:
            try:
                from app.core.security import _hash_key
                from app.db.models.api_key import ApiKey
                db = SessionLocal()
                row = db.query(ApiKey).filter(ApiKey.key_hash == _hash_key(api_key), ApiKey.is_active == True).first()  # noqa
                org_id = row.org_id if row else None
            except Exception:
                org_id = None
            finally:
                try: db.close()
                except Exception: pass

        if org_id:
            try:
                db = SessionLocal()
                db.add(UsageEvent(
                    org_id=org_id,
                    method=request.method,
                    path=request.url.path,
                    status=response.status_code,
                    latency_ms=ms,
                ))
                db.commit()
            except Exception:
                pass
            finally:
                try: db.close()
                except Exception: pass

        return response

app.add_middleware(UsageMiddleware)

app.include_router(api_router, prefix="/api/v1")
