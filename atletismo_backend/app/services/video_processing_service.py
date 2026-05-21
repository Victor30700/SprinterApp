# app/services/video_processing_service.py
from typing import Optional, List, Dict, Any # Para Python < 3.10, sino usar | None
from app.services.firebase_service import firebase_service # Asumimos que este servicio está implementado y es asíncrono
from app.api.v1.schemas.video_schemas import PoseData, PoseFrame, Keypoint
from app.core.config import settings
import tempfile
import os
import asyncio
import json
import cv2 # pip install opencv-python
import mediapipe as mp # pip install mediapipe
import shutil
import platform
import subprocess
import sys
import math # Importante para cálculos biomecánicos

# Configuración de MediaPipe Pose
mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils # Para visualización si es necesario, no para datos JSON
BLAZEPOSE_KEYPOINT_NAMES = [
    "nose", "left_eye_inner", "left_eye", "left_eye_outer", "right_eye_inner", "right_eye", "right_eye_outer",
    "left_ear", "right_ear", "mouth_left", "mouth_right", "left_shoulder", "right_shoulder", "left_elbow",
    "right_elbow", "left_wrist", "right_wrist", "left_pinky", "right_pinky", "left_index", "right_index",
    "left_thumb", "right_thumb", "left_hip", "right_hip", "left_knee", "right_knee", "left_ankle",
    "right_ankle", "left_heel", "right_heel", "left_foot_index", "right_foot_index"
] # 33 keypoints de BlazePose

class VideoProcessingService:

    def __init__(self):
        self.ffmpeg_path = self._find_ffmpeg()
        self.ffprobe_path = self._find_ffprobe()
        # Configurar el event loop policy para Windows si es necesario
        if platform.system() == "Windows":
            # Usar ProactorEventLoop en Windows para mejor compatibilidad con subprocesos
            if sys.version_info >= (3, 8):
                try:
                    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
                except AttributeError:
                    pass  # Versión de Python que no tiene esta policy
    
    def _find_ffmpeg(self) -> str:
        """Encuentra la ruta de FFmpeg en el sistema"""
        # Primero intentar desde settings
        if hasattr(settings, "FFMPEG_PATH") and settings.FFMPEG_PATH:
            if os.path.isfile(settings.FFMPEG_PATH):
                return settings.FFMPEG_PATH
            print(f"Warning: FFMPEG_PATH en settings no existe: {settings.FFMPEG_PATH}")
        
        # Buscar en PATH del sistema
        ffmpeg_cmd = "ffmpeg.exe" if platform.system() == "Windows" else "ffmpeg"
        ffmpeg_path = shutil.which(ffmpeg_cmd)
        
        if ffmpeg_path:
            print(f"FFmpeg encontrado en: {ffmpeg_path}")
            return ffmpeg_path
        
        # Rutas comunes en Windows
        if platform.system() == "Windows":
            common_paths = [
                r"C:\ffmpeg\bin\ffmpeg.exe",
                r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
                r"C:\Program Files (x86)\ffmpeg\bin\ffmpeg.exe",
            ]
            for path in common_paths:
                if os.path.isfile(path):
                    print(f"FFmpeg encontrado en ruta común: {path}")
                    return path
        
        raise FileNotFoundError("FFmpeg no encontrado. Instale FFmpeg y asegúrese de que esté en el PATH del sistema.")
    
    def _find_ffprobe(self) -> str:
        """Encuentra la ruta de FFprobe en el sistema"""
        # Derivar desde FFmpeg path
        ffmpeg_dir = os.path.dirname(self.ffmpeg_path)
        ffprobe_name = "ffprobe.exe" if platform.system() == "Windows" else "ffprobe"
        ffprobe_path = os.path.join(ffmpeg_dir, ffprobe_name)
        
        if os.path.isfile(ffprobe_path):
            return ffprobe_path
        
        # Buscar en PATH
        ffprobe_path = shutil.which(ffprobe_name)
        if ffprobe_path:
            return ffprobe_path
        
        raise FileNotFoundError("FFprobe no encontrado junto a FFmpeg.")

    async def process_video_pipeline(self, user_id: str, video_id: str):
        """
        Orquesta todo el proceso de análisis de video.
        """
        print(f"Pipeline iniciado para: Usuario {user_id}, Video {video_id}")
        
        try:
            # Verificar que FFmpeg esté disponible antes de comenzar
            if not os.path.isfile(self.ffmpeg_path):
                error_msg = f"FFmpeg no encontrado en: {self.ffmpeg_path}"
                print(f"Error crítico: {error_msg}")
                await self._fail_job(user_id, video_id, "error_setup", error_msg)
                return
            
            video_metadata = await firebase_service.get_video_metadata(user_id, video_id)
            if not video_metadata:
                print(f"Error: No se encontraron metadatos para {user_id}/{video_id}")
                await self._fail_job(user_id, video_id, "error_setup", "Metadatos del video no encontrados en Firestore.")
                return

            original_storage_path = video_metadata.get('originalStoragePath')
            original_filename = video_metadata.get('originalFileName', f"{video_id}_video.mp4")

            if not original_storage_path:
                error_msg = "El campo 'originalStoragePath' es requerido y no se encontró en los metadatos del video."
                print(f"Error para {user_id}/{video_id}: {error_msg}")
                await self._fail_job(user_id, video_id, "error_setup", error_msg)
                return
            
            print(f"Procesando video: {original_filename}, StoragePath: {original_storage_path}")

            with tempfile.TemporaryDirectory() as temp_dir:
                base_name, ext = os.path.splitext(original_filename)
                if not ext: ext = ".mp4"
                
                local_original_video_path = os.path.join(temp_dir, f"original_{video_id}{ext}")
                local_processed_video_path = os.path.join(temp_dir, f"processed_{video_id}.mp4")
                local_pose_data_path = os.path.join(temp_dir, f"pose_data_{video_id}.json")

                # 1. Descargar video original
                await firebase_service.update_video_status(user_id, video_id, {"status": "downloading", "progress": 5})
                if not await firebase_service.download_file_from_storage(original_storage_path, local_original_video_path):
                    await self._fail_job(user_id, video_id, "error_download", "Fallo al descargar video original.")
                    return
                print(f"Video original descargado a: {local_original_video_path}")

                # 2. Procesar video con FFmpeg
                await firebase_service.update_video_status(user_id, video_id, {"status": "processing_ffmpeg", "progress": 15})
                ffmpeg_success, processed_video_info = await self._run_ffmpeg_processing(local_original_video_path, local_processed_video_path)
                if not ffmpeg_success:
                    error_message = processed_video_info.get("error", "Fallo durante el procesamiento con FFmpeg.")
                    print(f"Error FFmpeg: {error_message}")
                    await self._fail_job(user_id, video_id, "error_ffmpeg", error_message)
                    return
                print(f"Video procesado con FFmpeg: {local_processed_video_path}. Info: {processed_video_info}")

                # 3. Extraer datos de pose
                await firebase_service.update_video_status(user_id, video_id, {"status": "processing_pose", "progress": 45})
                pose_data_obj = await self._extract_pose_data_mediapipe(local_processed_video_path, video_id, processed_video_info)
                if not pose_data_obj:
                    await self._fail_job(user_id, video_id, "error_pose", "Fallo durante la extracción de datos de pose.")
                    return
                
                # --- NUEVO: 3.5 Calcular Métricas Biomecánicas e IA Summary ---
                print("Calculando métricas biomecánicas...")
                analysis_results = self._analyze_biomechanics(pose_data_obj)

                try:
                    with open(local_pose_data_path, 'w', encoding='utf-8') as f:
                        f.write(pose_data_obj.model_dump_json(indent=2, exclude_none=True))
                    print(f"Datos de pose guardados localmente en: {local_pose_data_path}")
                except Exception as e:
                    print(f"Error guardando datos de pose localmente: {e}")
                    await self._fail_job(user_id, video_id, "error_pose", f"Error guardando JSON de pose: {str(e)}")
                    return

                # 4. Subir video procesado y datos de pose a Storage
                await firebase_service.update_video_status(user_id, video_id, {"status": "uploading_results", "progress": 85})
                
                processed_video_storage_path = f"videos/{user_id}/processed/{video_id}.mp4"
                pose_data_storage_path = f"videos/{user_id}/poseData/{video_id}_pose_data.json"

                processed_url = await firebase_service.upload_file_to_storage(local_processed_video_path, processed_video_storage_path, "video/mp4")
                pose_data_url = await firebase_service.upload_file_to_storage(local_pose_data_path, pose_data_storage_path, "application/json")

                if not processed_url or not pose_data_url:
                    error_msg_upload = "Fallo al subir archivos procesados a Storage."
                    if not processed_url: error_msg_upload += " Video procesado no subido."
                    if not pose_data_url: error_msg_upload += " Datos de pose no subidos."
                    await self._fail_job(user_id, video_id, "error_upload", error_msg_upload)
                    return
                print(f"Archivos procesados subidos. Video: {processed_url}, Pose: {pose_data_url}")

                # 5. Actualizar Firestore con estado completado, URLs y RESUMEN IA
                final_status_data = {
                    "status": "completed",
                    "processedURL": processed_url,
                    "processedStoragePath": processed_video_storage_path,
                    "poseDataURL": pose_data_url,
                    "poseDataStoragePath": pose_data_storage_path,
                    "errorMessage": None,
                    "progress": 100,
                    "processedAt": firebase_service.get_server_timestamp(),
                    "videoDurationSeconds": pose_data_obj.video_duration,
                    # Datos inteligentes para Coach Nova
                    "aiSummary": analysis_results["summary"],
                    "metricsSummary": analysis_results["metrics"]
                }
                await firebase_service.update_video_status(user_id, video_id, final_status_data)
                print(f"Procesamiento completado exitosamente para {user_id}/{video_id}")
                
        except Exception as e:
            error_msg = f"Error inesperado en pipeline: {str(e)}"
            print(f"Error crítico en pipeline para {user_id}/{video_id}: {error_msg}")
            await self._fail_job(user_id, video_id, "error_setup", error_msg)

    async def _fail_job(self, uid, vid, status, msg):
        """Helper para reportar fallos y detener el proceso limpiamente en DB"""
        await firebase_service.update_video_status(
            uid, vid,
            {"status": status, "errorMessage": msg}
        )

    # --- NUEVA FUNCIÓN: EL CEREBRO BIOMECÁNICO ---
    def _analyze_biomechanics(self, pose_data: PoseData) -> Dict[str, Any]:
        """
        Analiza los datos crudos de pose para generar insights legibles por la IA.
        """
        frames = pose_data.frames
        if not frames:
            return {"summary": "No hay datos de movimiento detectados.", "metrics": {}}

        # Variables para acumular
        trunk_angles = []
        
        for frame in frames:
            # Convertir lista a diccionario para acceso rápido por nombre
            kp = {k.name: k for k in frame.keypoints if k.name and k.score is not None and k.score > 0.5}
            
            # 1. Ángulo del Tronco (Inclinación)
            # Vector Hombro Medio -> Cadera Media
            if all(k in kp for k in ["left_shoulder", "right_shoulder", "left_hip", "right_hip"]):
                mx_shoulder = (kp["left_shoulder"].x + kp["right_shoulder"].x) / 2
                my_shoulder = (kp["left_shoulder"].y + kp["right_shoulder"].y) / 2
                mx_hip = (kp["left_hip"].x + kp["right_hip"].x) / 2
                my_hip = (kp["left_hip"].y + kp["right_hip"].y) / 2
                
                # Delta y Ángulo con la vertical
                dy = my_shoulder - my_hip # Negativo si hombro está "arriba" en imagen (y=0 top)
                dx = mx_shoulder - mx_hip
                # Ángulo absoluto con la vertical (0 = parado recto, 90 = horizontal)
                angle = math.degrees(math.atan2(abs(dx), abs(dy)))
                trunk_angles.append(angle)

        # Promedios
        avg_trunk = sum(trunk_angles) / len(trunk_angles) if trunk_angles else 0
        duration = pose_data.video_duration or 0
        
        # Generar Resumen Narrativo (Prompt Engineering automático)
        summary = f"Video de {duration:.1f}s. "
        summary += f"Postura del tronco promedio: {avg_trunk:.1f}° respecto a la vertical. "
        
        if avg_trunk > 45:
            summary += "Posición muy inclinada (típica de salida baja o aceleración inicial). "
        elif avg_trunk > 15:
            summary += "Inclinación moderada (fase de transición o carrera lanzada). "
        else:
            summary += "Postura erguida (velocidad máxima o ejercicios estáticos). "

        return {
            "summary": summary,
            "metrics": {
                "avg_trunk_inclination": round(avg_trunk, 2),
                "duration_sec": round(duration, 2),
                "fps": pose_data.fps
            }
        }

    async def _run_ffmpeg_processing(self, input_path: str, output_path: str) -> tuple[bool, dict]:
        """
        Ejecuta FFmpeg para procesar el video.
        Versión mejorada con mejor soporte para Windows.
        """
        info_dict = {"error": "Proceso FFmpeg no completado."}
        
        try:
            # Validar que el archivo de entrada existe
            if not os.path.exists(input_path):
                error_msg = f"Archivo de entrada no encontrado: {input_path}"
                print(error_msg)
                info_dict["error"] = error_msg
                return False, info_dict
            
            # Validar que FFmpeg existe
            if not os.path.isfile(self.ffmpeg_path):
                error_msg = f"FFmpeg no encontrado en: {self.ffmpeg_path}"
                print(error_msg)
                info_dict["error"] = error_msg
                return False, info_dict
            
            # Comando FFmpeg simplificado para evitar problemas de escape en Windows
            command = [
                self.ffmpeg_path, 
                '-hide_banner', 
                '-loglevel', 'warning',
                '-i', input_path,
                '-c:v', 'libx264', 
                '-preset', 'fast', 
                '-profile:v', 'main',
                '-c:a', 'aac', 
                '-b:a', '128k',
                '-vf', 'fps=25,scale=trunc(iw/2)*2:trunc(ih/2)*2',
                '-movflags', '+faststart',
                '-y', output_path
            ]
            
            print(f"Ejecutando FFmpeg: {' '.join(command)}")
            
            # Usar subprocess.run en lugar de asyncio para mejor compatibilidad con Windows
            if platform.system() == "Windows":
                # Método síncrono para Windows (más confiable)
                result = await self._run_subprocess_windows(command)
                if result["success"]:
                    # Obtener información del video procesado usando ffprobe
                    ffprobe_success, probe_info = await self._run_ffprobe(output_path)
                    if ffprobe_success:
                        return True, probe_info
                    else:
                        # FFmpeg funcionó pero ffprobe falló, usar valores por defecto
                        print("Warning: ffprobe falló, usando valores por defecto")
                        info_dict = {
                            "width": 1280,
                            "height": 720,
                            "duration": 30.0,
                            "fps": 25.0,
                            "error": None
                        }
                        return True, info_dict
                else:
                    info_dict["error"] = result["error"]
                    return False, info_dict
            else:
                # Método asíncrono para Linux/Mac
                process = await asyncio.create_subprocess_exec(
                    *command, 
                    stdout=asyncio.subprocess.PIPE, 
                    stderr=asyncio.subprocess.PIPE,
                )
                
                # Esperar con timeout
                try:
                    stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=300)
                except asyncio.TimeoutError:
                    process.kill()
                    error_msg = "FFmpeg timeout después de 5 minutos"
                    print(error_msg)
                    info_dict["error"] = error_msg
                    return False, info_dict

                # Decodificar outputs
                stdout_text = stdout.decode('utf-8', errors='ignore') if stdout else ""
                stderr_text = stderr.decode('utf-8', errors='ignore') if stderr else ""
                
                print(f"FFmpeg returncode: {process.returncode}")
                if stdout_text:
                    print(f"FFmpeg stdout: {stdout_text}")
                if stderr_text:
                    print(f"FFmpeg stderr: {stderr_text}")

                if process.returncode != 0:
                    error_message = stderr_text.strip() or f"FFmpeg falló con código de salida {process.returncode}"
                    print(f"Error en FFmpeg: {error_message}")
                    info_dict["error"] = error_message
                    return False, info_dict
                
                # Verificar que el archivo de salida se creó
                if not os.path.exists(output_path):
                    error_msg = f"FFmpeg completó pero no se generó el archivo de salida: {output_path}"
                    print(error_msg)
                    info_dict["error"] = error_msg
                    return False, info_dict
                
                print("FFmpeg completado exitosamente.")

                # Obtener información del video procesado usando ffprobe
                ffprobe_success, probe_info = await self._run_ffprobe(output_path)
                if ffprobe_success:
                    return True, probe_info
                else:
                    # FFmpeg funcionó pero ffprobe falló, usar valores por defecto
                    print("Warning: ffprobe falló, usando valores por defecto")
                    info_dict = {
                        "width": 1280,
                        "height": 720,
                        "duration": 30.0,
                        "fps": 25.0,
                        "error": None
                    }
                    return True, info_dict

        except Exception as e:
            error_msg = f"Excepción inesperada en FFmpeg: {str(e)} (Tipo: {type(e).__name__})"
            print(error_msg)
            info_dict["error"] = error_msg
            return False, info_dict

    async def _run_subprocess_windows(self, command: list) -> dict:
        """
        Ejecuta un subproceso en Windows de manera asíncrona usando threading
        """
        import threading
        import queue
        
        def run_command():
            try:
                result = subprocess.run(
                    command,
                    capture_output=True,
                    text=True,
                    timeout=300,  # 5 minutos timeout
                    creationflags=subprocess.CREATE_NO_WINDOW if platform.system() == "Windows" else 0
                )
                return {
                    "success": result.returncode == 0,
                    "returncode": result.returncode,
                    "stdout": result.stdout,
                    "stderr": result.stderr,
                    "error": None if result.returncode == 0 else result.stderr or f"Proceso falló con código {result.returncode}"
                }
            except subprocess.TimeoutExpired:
                return {
                    "success": False,
                    "error": "FFmpeg timeout después de 5 minutos"
                }
            except Exception as e:
                return {
                    "success": False,
                    "error": f"Error ejecutando comando: {str(e)}"
                }
        
        # Ejecutar en thread separado para no bloquear el event loop
        result_queue = queue.Queue()
        
        def thread_wrapper():
            result = run_command()
            result_queue.put(result)
        
        thread = threading.Thread(target=thread_wrapper)
        thread.start()
        
        # Esperar resultado de manera asíncrona
        while thread.is_alive():
            await asyncio.sleep(0.1)
        
        thread.join()
        result = result_queue.get()
        
        if result["success"]:
            print("FFmpeg completado exitosamente.")
        else:
            print(f"Error en FFmpeg: {result['error']}")
            if result.get("stderr"):
                print(f"FFmpeg stderr: {result['stderr']}")
        
        return result

    async def _run_ffprobe(self, video_path: str) -> tuple[bool, dict]:
        """
        Ejecuta ffprobe para obtener información del video
        """
        try:
            if not os.path.isfile(self.ffprobe_path):
                return False, {"error": f"ffprobe no encontrado: {self.ffprobe_path}"}
            
            ffprobe_command = [
                self.ffprobe_path,
                '-v', 'quiet',
                '-print_format', 'json',
                '-show_format',
                '-show_streams',
                video_path
            ]

            print(f"Ejecutando ffprobe: {' '.join(ffprobe_command)}")
            
            if platform.system() == "Windows":
                # Usar el método Windows para ffprobe también
                result = await self._run_subprocess_windows(ffprobe_command)
                if not result["success"]:
                    return False, {"error": f"ffprobe error: {result['error']}"}
                
                stdout_text = result["stdout"]
            else:
                # Método asíncrono para Linux/Mac
                process = await asyncio.create_subprocess_exec(
                    *ffprobe_command, 
                    stdout=asyncio.subprocess.PIPE, 
                    stderr=asyncio.subprocess.PIPE
                )
                
                stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=30)

                if process.returncode != 0:
                    error_message = stderr.decode('utf-8', errors='ignore')
                    print(f"Error en ffprobe: {error_message}")
                    return False, {"error": f"ffprobe error: {error_message}"}
                
                stdout_text = stdout.decode('utf-8')

            try:
                probe_data = json.loads(stdout_text)
                
                # Buscar stream de video
                video_stream = None
                for stream in probe_data.get("streams", []):
                    if stream.get("codec_type") == "video":
                        video_stream = stream
                        break
                
                if not video_stream:
                    return False, {"error": "No se encontró stream de video"}
                
                # Extraer información
                width = int(video_stream.get("width", 0))
                height = int(video_stream.get("height", 0))
                
                # Manejar FPS
                fps_str = video_stream.get("r_frame_rate", "25/1")
                if '/' in fps_str:
                    num, den = fps_str.split('/')
                    fps = float(num) / float(den) if float(den) != 0 else 25.0
                else:
                    fps = float(fps_str)
                
                # Duración
                duration = float(video_stream.get("duration", 0.0))
                if duration == 0.0:
                    # Intentar desde format
                    duration = float(probe_data.get("format", {}).get("duration", 0.0))
                
                info_dict = {
                    "width": width,
                    "height": height,
                    "duration": duration,
                    "fps": fps,
                    "error": None
                }
                
                print(f"Info de video obtenida: {info_dict}")
                return True, info_dict
                
            except json.JSONDecodeError as e:
                error_msg = f"Error parseando JSON de ffprobe: {str(e)}"
                print(error_msg)
                return False, {"error": error_msg}

        except Exception as e:
            error_msg = f"Excepción en ffprobe: {str(e)}"
            print(error_msg)
            return False, {"error": error_msg}

    async def _extract_pose_data_mediapipe(self, video_path: str, video_id: str, video_info: dict) -> Optional[PoseData]:
        """
        Extrae datos de pose del video usando MediaPipe.
        Retorna un objeto PoseData o None si falla.
        """
        print(f"Iniciando extracción de pose (MediaPipe) para: {video_path} (ID: {video_id})")
        
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            print(f"Error: No se pudo abrir el video {video_path} con OpenCV.")
            return None

        # Usar información obtenida de ffprobe si está disponible
        video_width = video_info.get("width", int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)))
        video_height = video_info.get("height", int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)))
        fps = video_info.get("fps", cap.get(cv2.CAP_PROP_FPS))
        if fps == 0: fps = 25 # Fallback razonable
        
        total_frames_video = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        video_duration = video_info.get("duration", total_frames_video / fps if fps > 0 else 0)

        all_frames_data: List[PoseFrame] = []
        frame_count = 0

        # Configurar MediaPipe Pose
        with mp_pose.Pose(
            static_image_mode=False,
            model_complexity=1,
            enable_segmentation=False,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        ) as pose_estimator:
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break

                frame_timestamp = frame_count / fps

                # Convertir el frame de BGR a RGB
                image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                image_rgb.flags.writeable = False

                # Realizar detección de pose
                results = pose_estimator.process(image_rgb)
                
                current_keypoints: List[Keypoint] = []
                if results.pose_landmarks:
                    for idx, landmark in enumerate(results.pose_landmarks.landmark):
                        current_keypoints.append(Keypoint(
                            x=landmark.x,
                            y=landmark.y,
                            score=landmark.visibility,
                            name=BLAZEPOSE_KEYPOINT_NAMES[idx] if idx < len(BLAZEPOSE_KEYPOINT_NAMES) else f"custom_point_{idx}"
                        ))
                else:
                    # Si no se detectan landmarks, añadir keypoints con score 0
                    for idx in range(len(BLAZEPOSE_KEYPOINT_NAMES)):
                         current_keypoints.append(Keypoint(x=0.0, y=0.0, score=0.0, name=BLAZEPOSE_KEYPOINT_NAMES[idx]))

                all_frames_data.append(PoseFrame(time=frame_timestamp, keypoints=current_keypoints))
                frame_count += 1
                
                # Liberar CPU ocasionalmente
                if frame_count % 50 == 0:
                    await asyncio.sleep(0.001) 
                    print(f"Procesados {frame_count}/{total_frames_video if total_frames_video > 0 else '??'} frames para pose...")

        cap.release()
        print(f"Extracción de pose (MediaPipe) completada. {frame_count} frames procesados.")

        if not all_frames_data:
            print("No se extrajeron datos de pose.")
            return None

        return PoseData(
            model_used=f"MediaPipe Pose (model_complexity=1)",
            video_duration=video_duration,
            video_width=video_width,
            video_height=video_height,
            fps=fps,
            total_frames=frame_count,
            frames=all_frames_data
        )

# Instancia Singleton del servicio
video_processing_service = VideoProcessingService()