# app/api/v1/endpoints/videos.py
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Header
from app.api.v1.schemas.video_schemas import ProcessVideoRequest, VideoStatus
from app.services.video_processing_service import video_processing_service
from app.core.firebase_setup import get_firestore_client
import firebase_admin.auth
from typing import Annotated
from app.services.firebase_service import firebase_service

router = APIRouter()

# Dependencia para verificar el token de Firebase ID
async def verify_firebase_token(authorization: Annotated[str | None, Header()] = None):
    if not authorization:
        raise HTTPException(status_code=401, detail="Encabezado de autorización faltante")
    
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Formato de autorización inválido. Usar 'Bearer token'")
    
    token = parts[1]
    try:
        decoded_token = firebase_admin.auth.verify_id_token(token)
        return decoded_token
    except firebase_admin.auth.FirebaseError as e:
        print(f"Error verificando token de Firebase: {e}")
        raise HTTPException(status_code=401, detail=f"Token inválido o expirado: {str(e)}")
    except Exception as e:
        print(f"Excepción general verificando token: {e}")
        raise HTTPException(status_code=500, detail=f"Error interno verificando token: {str(e)}")


@router.post("/process-video", response_model=VideoStatus, status_code=202)
async def trigger_video_processing(
    process_request: ProcessVideoRequest,
    background_tasks: BackgroundTasks,
    current_user: Annotated[dict, Depends(verify_firebase_token)] 
):
    """
    Inicia el pipeline de procesamiento de video para un video dado.
    Esta es una operación larga, así que se ejecuta en segundo plano.
    """
    # Verificar que el userId en la solicitud coincida con el uid del token autenticado
    authenticated_user_id = current_user.get('uid')
    if not authenticated_user_id:
        raise HTTPException(status_code=401, detail="No se pudo obtener el UID del token.")

    if process_request.userId != authenticated_user_id:
        raise HTTPException(status_code=403, detail="El ID de usuario de la solicitud no coincide con el usuario autenticado.")

    print(f"Solicitud recibida para procesar video: Usuario {process_request.userId}, Video {process_request.videoId}")

    db = get_firestore_client()
    video_ref = db.collection('userVideos').document(process_request.userId).collection('videos').document(process_request.videoId)
    
    try:
        video_doc = video_ref.get()
        if video_doc.exists:
            data = video_doc.to_dict()
            status = data.get('status')
            # Verificar si el video ya está siendo procesado o completado
            if status in ['processing_ffmpeg', 'processing_pose', 'processing_queued']:
                return VideoStatus(
                    videoId=process_request.videoId, 
                    status=status, 
                    message="El video ya está en cola o en proceso."
                )
            if status == 'completed':
                return VideoStatus(
                    videoId=process_request.videoId, 
                    status="completed", 
                    message="El video ya fue procesado.",
                    processedURL=data.get('processedURL'),
                    poseDataURL=data.get('poseDataURL'),
                    # Devolver los campos nuevos si existen
                    aiSummary=data.get('aiSummary'),
                    metricsSummary=data.get('metricsSummary')
                )
            # Si el estado es 'uploaded' o 'error_ffmpeg', 'error_pose', permitir reprocesamiento
            if status not in ['uploaded', 'error_ffmpeg', 'error_pose']:
                 print(f"Estado actual del video {process_request.videoId}: {status}. Permitiendo (re)procesamiento.")

        else:
            raise HTTPException(status_code=404, detail=f"Documento del video no encontrado en Firestore para videoId: {process_request.videoId}. Asegúrate que el frontend lo haya creado.")

        # Actualizar estado a 'processing_queued' antes de encolar
        video_ref.update({
            'status': 'processing_queued', 
            'updatedAt': firebase_service.get_server_timestamp()
        })

    except Exception as e:
        print(f"Error al acceder a Firestore para verificar estado del video: {e}")
        pass

    # Añadir la tarea de procesamiento a las tareas en segundo plano
    background_tasks.add_task(
        video_processing_service.process_video_pipeline,
        process_request.userId,
        process_request.videoId,
    )

    return VideoStatus(
        videoId=process_request.videoId,
        status="processing_queued",
        message="El procesamiento del video ha sido encolado."
    )