# app/api/v1/api.py
from fastapi import APIRouter

# Importa tus endpoints
from app.api.v1.endpoints import videos

# Crea el enrutador principal para la versión 1 de la API
api_router = APIRouter()

# Incluye los endpoints bajo el prefijo /videos
api_router.include_router(
    videos.router,
    prefix="/videos",
    tags=["videos"]
)
