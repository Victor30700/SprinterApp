# app/services/firebase_service.py
from app.core.firebase_setup import get_firestore_client, get_storage_client
from google.cloud.firestore_v1.base_query import FieldFilter
from typing import Dict, Any, Optional
import datetime

class FirebaseService:
    def __init__(self):
        # Inicializa Firestore y Storage client
        self.db = get_firestore_client()
        self.bucket = get_storage_client()

    async def get_video_metadata(self, user_id: str, video_id: str) -> Optional[Dict[str, Any]]:
        """Obtiene los metadatos de un video desde Firestore."""
        try:
            video_ref = self.db.collection('userVideos').document(user_id).collection('videos').document(video_id)
            doc_snapshot = video_ref.get()
            if doc_snapshot.exists:
                return doc_snapshot.to_dict()
            return None
        except Exception as e:
            print(f"Error obteniendo metadatos del video {user_id}/{video_id}: {e}")
            return None

    async def update_video_status(self, user_id: str, video_id: str, data: Dict[str, Any]) -> bool:
        """Actualiza el estado y otros campos de un video en Firestore."""
        try:
            video_ref = self.db.collection('userVideos').document(user_id).collection('videos').document(video_id)
            video_ref.update(data)
            print(f"Video {user_id}/{video_id} actualizado con: {data}")
            return True
        except Exception as e:
            print(f"Error actualizando estado del video {user_id}/{video_id}: {e}")
            return False

    async def download_file_from_storage(self, blob_name: str, destination_file_name: str) -> bool:
        """Descarga un archivo desde Firebase Storage."""
        try:
            blob = self.bucket.blob(blob_name)
            blob.download_to_filename(destination_file_name)
            print(f"Archivo {blob_name} descargado a {destination_file_name}")
            return True
        except Exception as e:
            print(f"Error descargando archivo {blob_name}: {e}")
            return False

    async def upload_file_to_storage(self, source_file_name: str, destination_blob_name: str, content_type: Optional[str] = None) -> Optional[str]:
        """Sube un archivo a Firebase Storage y retorna una URL firmada de expiración temporal."""
        try:
            blob = self.bucket.blob(destination_blob_name)
            blob.upload_from_filename(source_file_name, content_type=content_type)
            # Genera URL firmada válida por 24 horas
            signed_url = blob.generate_signed_url(expiration=datetime.timedelta(hours=24))
            print(f"Archivo {source_file_name} subido a {destination_blob_name}. URL firmada: {signed_url}")
            return signed_url
        except Exception as e:
            print(f"Error subiendo archivo {source_file_name}: {e}")
            return None

    def get_server_timestamp(self):
        """Devuelve el valor de timestamp para escritura de servidor en Firestore."""
        from google.cloud.firestore import SERVER_TIMESTAMP
        return SERVER_TIMESTAMP

# Instancia Singleton del servicio
firebase_service = FirebaseService()
