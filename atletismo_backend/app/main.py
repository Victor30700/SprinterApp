# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.api.v1.api import api_router
from app.core.firebase_setup import initialize_firebase_app # Importar la función

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Código a ejecutar antes de que la aplicación empiece a aceptar solicitudes
    print("Iniciando aplicación FastAPI...")
    try:
        initialize_firebase_app() # Inicializar Firebase Admin SDK
    except Exception as e:
        # Manejar el error como consideres apropiado (log, salir, etc.)
        print(f"CRÍTICO: Falló la inicialización de Firebase durante el arranque de la aplicación: {e}")
        # Podrías decidir no continuar si Firebase es esencial
        # raise SystemExit(f"Fallo al inicializar Firebase: {e}")
    yield
    # Código a ejecutar después de que la aplicación haya terminado de manejar solicitudes
    print("Apagando aplicación FastAPI...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan # Usar el gestor de ciclo de vida
)

origins_to_use = settings.BACKEND_CORS_ORIGINS
if not origins_to_use:
    print(
        "ADVERTENCIA: BACKEND_CORS_ORIGINS está vacío. "
        "Usando orígenes de desarrollo local predeterminados."
    )
    origins_to_use = ["http://localhost:5173", "http://127.0.0.1:5173"] # Ajusta según necesidad

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins_to_use,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/", tags=["Root"])
async def read_root():
    return {"message": f"Bienvenido a {settings.PROJECT_NAME}. Visita {app.openapi_url} o {settings.API_V1_STR}/docs para la documentación de la API."}
