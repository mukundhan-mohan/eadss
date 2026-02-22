from fastapi import APIRouter

from app.api.v1.endpoints.health import router as health_router
from app.api.v1.endpoints.ingest import router as ingest_router
from app.api.v1.endpoints.documents import router as documents_router
from app.api.v1.endpoints.inference import router as inference_router
from app.api.v1.endpoints.alerts import router as alerts_router
from app.api.v1.endpoints.tickets import router as tickets_router
from app.api.v1.endpoints.orgs import router as orgs_router
from app.api.v1.endpoints.usage import router as usage_router
from app.api.v1.endpoints.admin_auth import router as admin_auth_router

api_router = APIRouter()

api_router.include_router(health_router, tags=["health"])
api_router.include_router(ingest_router, tags=["ingest"])
api_router.include_router(documents_router, tags=["documents"])
api_router.include_router(inference_router, tags=["inference"])
api_router.include_router(alerts_router, tags=["alerts"])
api_router.include_router(tickets_router, tags=["tickets"])
api_router.include_router(orgs_router, tags=["orgs"])
api_router.include_router(usage_router, tags=["usage"])
api_router.include_router(admin_auth_router, tags=["admin"])