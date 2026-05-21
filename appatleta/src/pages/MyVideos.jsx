// src/pages/MyVideos.jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext'; // Asegúrate que la ruta sea correcta
import { db } from '../config/firebase'; // Asegúrate que la ruta sea correcta
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
// import { toast } from 'react-hot-toast'; // Descomentar si usas react-hot-toast
import styles from '../styles/MyVideos.module.css';

export default function MyVideos() {
  const { user } = useAuth();
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      // Opcionalmente redirigir a login si no hay usuario
      // navigate('/login'); 
      return;
    }

    setIsLoading(true);
    setError('');

    // Construir la ruta a la subcolección de videos del usuario
    const videosCollectionRef = collection(db, 'userVideos', user.uid, 'videos');
    const q = query(videosCollectionRef, orderBy('createdAt', 'desc'));

    // Escuchar cambios en tiempo real
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const videosData = querySnapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setVideos(videosData);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error al obtener videos:', err);
        setError('No se pudieron cargar los videos. Intenta de nuevo más tarde.');
        // toast.error('No se pudieron cargar los videos.');
        setIsLoading(false);
      }
    );

    // Limpiar el listener al desmontar el componente
    return () => unsubscribe();
  }, [user, navigate]);

  const handleProcessVideo = async (videoId) => {
  if (!user) {
    alert('Debes iniciar sesión para procesar videos.');
    return;
  }

  alert(`Iniciando procesamiento para el video: ${videoId}`);

  try {
    const idToken = await user.getIdToken();
    // Usar la variable de entorno para la URL base
    const backendUrl = import.meta.env.VITE_API_BACKEND_URL || 'http://localhost:8000';
    // URL CORRECTA con /videos incluido
    const url = `${backendUrl}/api/v1/videos/process-video`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({ userId: user.uid, videoId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = errorData.detail || errorData.message || `Error HTTP ${response.status}`;
      throw new Error(errorMessage);
    }

    const result = await response.json();
    alert(result.message || 'Procesamiento encolado. El estado se actualizará pronto.');

    // Actualizar el estado del video localmente
    setVideos(prevVideos => prevVideos.map(v =>
      v.id === videoId ? { ...v, status: result.status || 'processing_queued' } : v
    ));
  } catch (err) {
    console.error('Error al solicitar el procesamiento del video:', err);
    alert(`Error al iniciar el procesamiento: ${err.message}`);
  }
};

  const handleEditMeta = async (video) => {
    const { value: formValues } = await Swal.fire({
      title: 'Editar título y descripción',
      html:
        `<input id="swal-title" class="swal2-input" placeholder="Título" value="${video.title || ''}">` +
        `<textarea id="swal-desc" class="swal2-textarea" placeholder="Descripción">${video.description || ''}</textarea>`,
      focusConfirm: false,
      showCancelButton: true,
      preConfirm: () => {
        const newTitle = document.getElementById('swal-title').value;
        const newDesc = document.getElementById('swal-desc').value;
        if (!newTitle.trim() || !newDesc.trim()) {
          Swal.showValidationMessage('Ambos campos son obligatorios');
        }
        return { newTitle, newDesc };
      }
    });

    if (formValues) {
      try {
        const videoRef = doc(db, 'userVideos', user.uid, 'videos', video.id);
        await updateDoc(videoRef, {
          title: formValues.newTitle,
          description: formValues.newDesc,
        });
        setVideos(prev => prev.map(v => v.id === video.id ? { ...v, title: formValues.newTitle, description: formValues.newDesc } : v));
        Swal.fire('Actualizado', 'Título y descripción actualizados.', 'success');
      } catch (err) {
        console.error('Error al actualizar metadatos:', err);
        Swal.fire('Error', 'No se pudo actualizar.', 'error');
      }
    }
  };

  const handleDeleteVideo = async (video) => {
    const result = await Swal.fire({
      title: '¿Eliminar video?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    });

    if (result.isConfirmed) {
      try {
        // Eliminar el documento del video de Firestore
        const videoRef = doc(db, 'userVideos', user.uid, 'videos', video.id);
        await deleteDoc(videoRef);

        // Actualizar el contador del usuario (decrementar)
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, { 
          videoCount: increment(-1),
          lastVideoDeleted: serverTimestamp()
        }, { merge: true });

        // Actualizar el estado local
        setVideos(prev => prev.filter(v => v.id !== video.id));
        
        Swal.fire('Eliminado', 'El video ha sido eliminado. Ahora puedes subir un nuevo video.', 'success');
      } catch (err) {
        console.error('Error al eliminar video:', err);
        Swal.fire('Error', 'No se pudo eliminar el video.', 'error');
      }
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'uploaded': return 'Listo para procesar';
      case 'processing_ffmpeg': return 'Procesando video (FFmpeg)...';
      case 'processing_pose': return 'Extrayendo pose...';
      case 'completed': return 'Análisis completado';
      case 'error_ffmpeg': return 'Error en FFmpeg';
      case 'error_pose': return 'Error en extracción de pose';
      default: return 'Desconocido';
    }
  };

  if (isLoading) {
    return <div className={styles.loading}>Cargando videos...</div>;
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }
  
  if (!user) {
     return <div className={styles.container}><p>Por favor, <a href="/login">inicia sesión</a> para ver tus videos.</p></div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className="{styles.btnBlack}" onClick={() => navigate('/')}>
          ⬅ Volver al Inicio
        </button>
        <h2 className={styles.title}>🎬 Mis Videos</h2>
        
        {/* Mostrar conteo actual de videos */}
        <div className={styles.videoCount}>
          <span className={`${styles.countBadge} ${videos.length >= 5 ? styles.limitReached : ''}`}>
            {videos.length}/5 videos
          </span>
        </div>
        
        <button 
          onClick={() => navigate('/video-upload')} 
          className={`${styles.uploadNavButton} ${videos.length >= 5 ? styles.disabled : ''}`}
          disabled={videos.length >= 5}
        >
          {videos.length >= 5 ? 'Límite alcanzado' : 'Subir Nuevo Video'}
        </button>
      </div>

      {videos.length === 0 ? (
        <div className={styles.noVideos}>
          <p>No has subido ningún video aún.</p>
          <p className={styles.hint}>Puedes subir hasta 5 videos para análisis.</p>
        </div>
      ) : (
        <ul className={styles.videoList}>
          {videos.map((video) => (
            <li key={video.id} className={styles.videoCard}>
              <div className={styles.videoThumbnail}>
                {video.thumbnailURL ? (
                    <img src={video.thumbnailURL} alt={`Thumbnail de ${video.title || video.originalFileName}`} />
                ) : video.processedURL || video.originalURL ? (
                  <video 
                    src={video.processedURL || video.originalURL} 
                    width="200" 
                    preload="metadata" // Solo carga metadatos
                  />
                ) : (
                  <div className={styles.noPreview}>Sin vista previa</div>
                )}
              </div>
              <div className={styles.videoInfo}>
                <h3 className={styles.videoName}>{video.title || video.originalFileName || 'Video sin nombre'}</h3>
                <p className={styles.videoDesc}>{video.description}</p>
                <p className={styles.videoStatus}>
                  Estado: <span className={`${styles.statusBadge} ${styles[video.status]}`}>{getStatusLabel(video.status)}</span>
                </p>
                <p className={styles.videoDate}>
                  Subido: {video.createdAt?.toDate().toLocaleDateString()}
                </p>
              </div>
              <div className={styles.videoActions}>
                {video.status === 'uploaded' && (
                  <button onClick={() => handleProcessVideo(video.id)} className={styles.actionButton}>
                    Procesar Video
                  </button>
                )}
                {(video.status === 'error_ffmpeg' || video.status === 'error_pose') && (
                  <button onClick={() => handleProcessVideo(video.id)} className={`${styles.actionButton} ${styles.retryButton}`}>
                    Reintentar Procesamiento
                  </button>
                )}
                {video.status === 'completed' && (
                  <button onClick={() => navigate(`/video-analysis/${video.id}`)} className={`${styles.actionButton} ${styles.analyzeButton}`}>
                    Ver Análisis
                  </button>
                )}
                {(video.status === 'processing_ffmpeg' || video.status === 'processing_pose') && (
                  <div className={styles.processingSpinner}>⚙️</div>
                )}
                {/* NUEVAS OPCIONES: Editar y Eliminar */}
                <button onClick={() => handleEditMeta(video)} className={`${styles.actionButton} ${styles.editButton}`}>
                  Editar
                </button>
                <button onClick={() => handleDeleteVideo(video)} className={`${styles.actionButton} ${styles.deleteButton}`}>
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}