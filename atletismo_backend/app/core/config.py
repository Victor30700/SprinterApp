# app/core/config.py
import os
from dotenv import load_dotenv
from typing import List, Union, Optional # Importa List y Union para tipado

# Carga las variables de entorno desde el archivo .env
# Es importante llamar a load_dotenv() antes de acceder a las variables de entorno
# Busca el .env subiendo en la jerarquía de directorios desde este archivo
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env') # Sube dos niveles para encontrar .env
load_dotenv(dotenv_path=dotenv_path)

class Settings:
    PROJECT_NAME: str = "Atletismo Video Analysis Backend"
    API_V1_STR: str = "/api/v1"

    # Firebase
    # GOOGLE_APPLICATION_CREDENTIALS se usa automáticamente por las librerías de Google si está seteado en el entorno.
    # No necesitas leerlo explícitamente aquí si firebase_admin lo va a usar directamente.
    # Sin embargo, es bueno tener la variable para claridad o si la necesitas en otro lado.
    FIREBASE_SERVICE_ACCOUNT_KEY_PATH: Optional[str] = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    FIREBASE_STORAGE_BUCKET: Optional[str] = os.getenv("FIREBASE_STORAGE_BUCKET")

    # Configuración de CORS
    # Lee la variable de entorno BACKEND_CORS_ORIGINS.
    # Se espera una cadena de URLs separadas por comas, o una lista.
    # Si no se define, podría usarse una lista vacía o un valor predeterminado seguro.
    _cors_origins_str: Optional[str] = os.getenv("BACKEND_CORS_ORIGINS")
    if _cors_origins_str:
        BACKEND_CORS_ORIGINS: List[str] = [origin.strip() for origin in _cors_origins_str.split(',')]
    else:
        # Define un valor predeterminado si no se encuentra en .env
        # Por ejemplo, permitir solo el frontend local durante el desarrollo
        BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"] # Ajusta estos según tu frontend

    # Puedes añadir otras configuraciones aquí
    # OPENAI_API_KEY: str = os.getenv("VITE_OPENAI_API_KEY") # Si el backend lo necesita

settings = Settings()

# Verificación de variables cruciales
if not settings.FIREBASE_SERVICE_ACCOUNT_KEY_PATH:
    print("ADVERTENCIA: FIREBASE_SERVICE_ACCOUNT_KEY_PATH no está configurado en .env. Algunas funcionalidades de Firebase pueden no estar disponibles.")
    # Considera lanzar un error si es absolutamente esencial para el arranque:
    # raise ValueError("FIREBASE_SERVICE_ACCOUNT_KEY_PATH es requerido y no está configurado en .env")

if not settings.FIREBASE_STORAGE_BUCKET:
    print("ADVERTENCIA: FIREBASE_STORAGE_BUCKET no está configurado en .env. Algunas funcionalidades de Firebase Storage pueden no estar disponibles.")
    # Considera lanzar un error si es absolutamente esencial para el arranque:
    # raise ValueError("FIREBASE_STORAGE_BUCKET es requerido y no está configurado en .env")

if not settings.BACKEND_CORS_ORIGINS:
    print("ADVERTENCIA: BACKEND_CORS_ORIGINS no está configurado en .env o está vacío. Se usarán valores predeterminados. Esto podría restringir el acceso de tu frontend.")

# Imprime las configuraciones cargadas para depuración (opcional)
# print(f"Configuraciones cargadas: {settings.__dict__}")
