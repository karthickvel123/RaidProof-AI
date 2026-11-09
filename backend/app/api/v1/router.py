from fastapi import APIRouter
from app.api.v1.endpoints import voice, incidents, evidence, dossier, checklist

api_router = APIRouter()
api_router.include_router(voice.router)
api_router.include_router(incidents.router)
api_router.include_router(evidence.router)
api_router.include_router(dossier.router)
api_router.include_router(checklist.router)
