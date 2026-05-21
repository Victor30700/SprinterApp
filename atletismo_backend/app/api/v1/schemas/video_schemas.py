# app/api/v1/schemas/video_schemas.py
from pydantic import BaseModel, HttpUrl, Field
from typing import Optional, List, Dict, Any

class ProcessVideoRequest(BaseModel):
    userId: str
    videoId: str
    # originalStoragePath: Optional[str] = None # El backend debería obtenerlo de Firestore

class VideoStatus(BaseModel):
    videoId: str
    status: str # e.g., "uploaded", "processing_queued", "processing_ffmpeg", "processing_pose", "completed", "error_setup", "error_download", "error_ffmpeg", "error_pose", "error_upload"
    message: Optional[str] = None
    processedURL: Optional[HttpUrl] = None
    poseDataURL: Optional[HttpUrl] = None
    progress: Optional[int] = None # Porcentaje de progreso (0-100)
    
    # --- NUEVOS CAMPOS PARA IA CONTEXT ---
    aiSummary: Optional[str] = Field(None, description="Resumen narrativo generado automáticamente sobre la biomecánica.")
    metricsSummary: Optional[Dict[str, Any]] = Field(None, description="Datos clave calculados (ángulos, cadencia, etc).")

# Para los datos de pose que guardarás en el JSON
class Keypoint(BaseModel):
    x: float = Field(description="Coordenada X normalizada (0.0 a 1.0) relativa al ancho del video.")
    y: float = Field(description="Coordenada Y normalizada (0.0 a 1.0) relativa al alto del video.")
    score: Optional[float] = Field(None, description="Confianza de la detección del keypoint (0.0 a 1.0).")
    name: Optional[str] = Field(None, description="Nombre descriptivo del keypoint (ej. 'nose', 'left_wrist').")

class PoseFrame(BaseModel):
    # frame_number: Optional[int] = Field(None, description="Número de frame secuencial (opcional).") # El frontend usa 'time'
    time: float = Field(description="Timestamp del frame en segundos desde el inicio del video.")
    keypoints: List[Keypoint]

class PoseData(BaseModel):
    # video_id: str # Ya está implícito por el contexto del archivo/documento
    model_used: Optional[str] = Field(None, description="Nombre o versión del modelo de detección de pose utilizado.")
    video_duration: Optional[float] = Field(None, description="Duración total del video procesado en segundos.")
    video_width: Optional[int] = Field(None, description="Ancho del video procesado en píxeles.")
    video_height: Optional[int] = Field(None, description="Alto del video procesado en píxeles.")
    fps: Optional[float] = Field(None, description="Frames por segundo del video procesado.")
    total_frames: Optional[int] = Field(None, description="Número total de frames en el video procesado.")
    frames: List[PoseFrame] = Field(description="Lista de frames, cada uno con sus keypoints.")