# app/core/firebase_setup.py
import firebase_admin
from firebase_admin import credentials, firestore, storage
from app.core.config import settings
import os

# Variable global para verificar si la app ya fue inicializada
_firebase_app_initialized = False

def initialize_firebase_app():
    """
    Initializes the Firebase Admin SDK app if it hasn't been already.
    Uses the service account key path from settings.
    """
    global _firebase_app_initialized
    if not _firebase_app_initialized and not firebase_admin._apps:
        # Verificar que la ruta al archivo de credenciales exista
        if not settings.FIREBASE_SERVICE_ACCOUNT_KEY_PATH:
            raise ValueError("FIREBASE_SERVICE_ACCOUNT_KEY_PATH no está configurado en .env o settings.")
        
        # Construir la ruta absoluta al archivo de credenciales
        # Asumiendo que la ruta en .env es relativa a la raíz del proyecto
        service_account_path = os.path.abspath(settings.FIREBASE_SERVICE_ACCOUNT_KEY_PATH)

        if not os.path.exists(service_account_path):
            raise FileNotFoundError(
                f"El archivo de credenciales de Firebase no se encontró en la ruta: {service_account_path}. "
                "Asegúrate de que GOOGLE_APPLICATION_CREDENTIALS o FIREBASE_SERVICE_ACCOUNT_KEY_PATH en tu .env "
                "apunten al archivo serviceAccountKey.json correcto relativo a la raíz del proyecto."
            )

        try:
            cred = credentials.Certificate(service_account_path)
            firebase_admin.initialize_app(cred, {
                'storageBucket': settings.FIREBASE_STORAGE_BUCKET
            })
            print("Firebase Admin SDK inicializado correctamente.")
            _firebase_app_initialized = True
        except Exception as e:
            print(f"Error al inicializar Firebase Admin SDK: {e}")
            # Podrías querer que la app falle si Firebase es esencial
            raise RuntimeError(f"No se pudo inicializar Firebase Admin SDK: {e}") from e
    elif firebase_admin._apps:
        # Si ya hay apps inicializadas (quizás por GOOGLE_APPLICATION_CREDENTIALS automáticamente)
        # pero nuestra bandera no está puesta, la actualizamos.
        _firebase_app_initialized = True
        print("Firebase Admin SDK ya estaba inicializado (posiblemente de forma automática).")


def get_firestore_client():
    """
    Returns a Firestore client. Ensures Firebase app is initialized.
    """
    if not _firebase_app_initialized:
        initialize_firebase_app() # Asegurar inicialización
    return firestore.client()

def get_storage_client():
    """
    Returns a Firebase Storage client (bucket). Ensures Firebase app is initialized.
    """
    if not _firebase_app_initialized:
        initialize_firebase_app() # Asegurar inicialización
    # El bucket se configura en initialize_app, aquí lo obtenemos por defecto
    # o podrías especificar el nombre del bucket si es necesario.
    return storage.bucket()

# Podrías llamar a initialize_firebase_app() aquí si quieres que se intente
# inicializar tan pronto como se importe este módulo, pero es más controlable
# hacerlo en el evento startup de FastAPI.