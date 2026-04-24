from fastapi import APIRouter

from app.api.v1.endpoints import admin, alerts, auth, copilot, opportunities, saved

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(opportunities.router)
api_router.include_router(copilot.router)
api_router.include_router(saved.router)
api_router.include_router(alerts.router)
api_router.include_router(admin.router)
