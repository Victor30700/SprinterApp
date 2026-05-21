// src/pages/VideoUpload.jsx

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, storage } from '../config/firebase';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { doc, getDoc, setDoc, increment, serverTimestamp, collection, query, getDocs } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/VideoUpload.module.css';

export default function VideoUpload() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  // Handler para el input de archivo
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // Validar tipo de archivo
      const allowedTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/avi'];
      if (!allowedTypes.includes(selectedFile.type)) {
        setError('Tipo de archivo no permitido. Use MP4, MOV, WebM o AVI.');
        return;
      }
      
      // Validar tamaño (ej: máximo 100MB)
      const maxSize = 100 * 1024 * 1024; // 100MB
      if (selectedFile.size > maxSize) {
        setError('El archivo es demasiado grande. Máximo 100MB.');
        return;
      }
      
      setFile(selectedFile);
      setError('');
    } else {
      setFile(null);
    }
  };

  // Contador de videos actuales del usuario
  const getCurrentVideoCount = async (userId) => {
    try {
      const videosCollectionRef = collection(db, 'userVideos', userId, 'videos');
      const q = query(videosCollectionRef);
      const querySnapshot = await getDocs(q);
      return querySnapshot.size;
    } catch (error) {
      console.error('Error al contar videos:', error);
      throw new Error('No se pudo verificar el número de videos actual.');
    }
  };

  // Handler principal de subida de video mejorado
  const handleUploadImproved = async (e) => {
    e.preventDefault();
    console.log('Usuario autenticado:', user);
    
    // Validaciones
    if (!file) {
      setError('Por favor, selecciona un archivo de video.');
      return;
    }
    if (!title.trim()) {
      setError('Por favor, ingresa el título del video.');
      return;
    }
    if (!description.trim()) {
      setError('Por favor, ingresa la descripción del video.');
      return;
    }
    if (!user) {
      setError('Debes iniciar sesión para subir videos.');
      return;
    }

    setIsUploading(true);
    setError('');
    setProgress(0);

    try {
      // Verificar el conteo actual de videos
      const currentVideoCount = await getCurrentVideoCount(user.uid);

      if (currentVideoCount >= 5) {
        setError('Has alcanzado el límite de 5 videos. No puedes subir más.');
        setIsUploading(false);
        return;
      }

      // Asegurar que el usuario esté autenticado
      await user.reload();
      const currentUser = user;
      if (!currentUser) {
        setError('Sesión expirada. Por favor, inicia sesión nuevamente.');
        setIsUploading(false);
        return;
      }

      // Preparar datos para subir a Storage
      const videoId = uuidv4();
      const fileExt = file.name.split('.').pop().toLowerCase();
      const sanitizedFileName = `${videoId}.${fileExt}`;
      const storagePath = `videos/${user.uid}/original/${sanitizedFileName}`;

      console.log('Iniciando subida a Storage:', storagePath);
      const storageRef = ref(storage, storagePath);

      const metadata = {
        contentType: file.type,
        cacheControl: 'public, max-age=31536000',
        customMetadata: {
          originalFileName: file.name,
          userId: user.uid,
          videoId: videoId,
          uploadedAt: new Date().toISOString()
        }
      };

      const uploadTask = uploadBytesResumable(storageRef, file, metadata);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          setProgress(percent);
          console.log(`Progreso de subida: ${percent}%`);
        },
        (uploadError) => {
          console.error('Error durante la subida:', uploadError);
          let errorMessage = 'Error al subir el archivo.';
          
          switch (uploadError.code) {
            case 'storage/unauthorized':
              errorMessage = 'No tienes permisos para subir archivos. Verifica tu autenticación.';
              break;
            case 'storage/canceled':
              errorMessage = 'La subida fue cancelada.';
              break;
            case 'storage/quota-exceeded':
              errorMessage = 'Se ha excedido la cuota de almacenamiento.';
              break;
            case 'storage/invalid-format':
              errorMessage = 'El formato del archivo no es válido.';
              break;
            case 'storage/retry-limit-exceeded':
              errorMessage = 'Se excedió el límite de reintentos. Verifica tu conexión a internet.';
              break;
            default:
              errorMessage = `Error: ${uploadError.message}`;
          }
          
          setError(errorMessage);
          setIsUploading(false);
          setProgress(0);
        },
        async () => {
          try {
            console.log('Subida completada, obteniendo URL de descarga...');
            
            // Pequeña pausa para asegurar que el archivo esté disponible
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log('URL de descarga obtenida:', downloadURL);

            // Verificar nuevamente el conteo antes de guardar
            const finalVideoCount = await getCurrentVideoCount(user.uid);
            if (finalVideoCount >= 5) {
              setError('Límite alcanzado durante la subida. No se puede completar.');
              setIsUploading(false);
              return;
            }

            // Guardar en Firestore
            console.log('Guardando metadatos en Firestore...');
            const videoDocRef = doc(db, 'userVideos', user.uid, 'videos', videoId);
            await setDoc(videoDocRef, {
              id: videoId,
              userId: user.uid,
              userEmail: user.email,
              title: title.trim(),
              description: description.trim(),
              originalURL: downloadURL,
              originalStoragePath: storagePath,
              originalFileName: file.name,
              processedURL: null,
              poseDataURL: null,
              status: 'uploaded',
              createdAt: serverTimestamp(),
              videoCountOnUpload: finalVideoCount + 1,
              fileType: file.type,
              fileSize: file.size,
            });

            // Actualizar contador del usuario
            const userDocRef = doc(db, 'users', user.uid);
            await setDoc(userDocRef, { 
              videoCount: increment(1),
              lastUpload: serverTimestamp()
            }, { merge: true });

            console.log('Metadatos guardados en Firestore');

            // Llamada al backend
            try {
              console.log('Enviando solicitud al backend...');
              const idToken = await user.getIdToken(true); // Force refresh
              const backendUrl = import.meta.env.VITE_API_BACKEND_URL || 'http://localhost:8000';
              
              const response = await fetch(
                `${backendUrl}/api/v1/videos/process-video`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${idToken}`,
                  },
                  body: JSON.stringify({ 
                    userId: user.uid, 
                    videoId: videoId 
                  }),
                }
              );

              if (response.ok) {
                console.log('Backend notificado exitosamente');
              } else {
                console.warn('Backend respondió con error:', response.status, response.statusText);
              }
            } catch (apiErr) {
              console.error('Error comunicándose con el backend:', apiErr);
              // No detiene el flujo si el backend falla
            }

            alert('¡Video subido correctamente! El procesamiento comenzará pronto.');

            // Reset del formulario
            setProgress(0);
            setFile(null);
            setTitle('');
            setDescription('');
            const fileInput = document.getElementById('videoFile');
            if (fileInput) fileInput.value = '';
            setIsUploading(false);

            // Navegar a "Mis Videos"
            navigate('/my-videos');
            
          } catch (urlError) {
            console.error('Error obteniendo URL o guardando en Firestore:', urlError);
            setError('El archivo se subió pero hay un problema para finalizar el proceso. Intenta refrescar la página.');
            setIsUploading(false);
          }
        }
      );
    } catch (err) {
      console.error('Error general en la subida:', err);
      setError(err.message || 'Error desconocido en la subida.');
      setIsUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className={styles.container}>
      <button className={styles.btnBack} onClick={() => navigate(-1)}>← Volver</button>
      <h2 className={styles.title}>📤 Subir Video para Análisis</h2>
      <p className={styles.description}>Súbele un video (máx. 5). Formatos: MP4, MOV, AVI, WebM.</p>
      <form onSubmit={handleUploadImproved} className={styles.form}>
        <div className={styles.inputGroup}>
          <label htmlFor="title" className={styles.label}>Título:</label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className={styles.textInput}
            required
          />
        </div>
        <div className={styles.inputGroup}>
          <label htmlFor="description" className={styles.label}>Descripción:</label>
          <textarea
            id="description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className={styles.textArea}
            required
          />
        </div>
        <div className={styles.fileInputContainer}>
          <input
            type="file"
            id="videoFile"
            accept="video/mp4,video/quicktime,video/webm,video/avi"
            onChange={handleFileChange}
            disabled={isUploading}
            className={styles.fileInput}
          />
          <label htmlFor="videoFile" className={styles.fileInputLabel}>
            {file ? file.name : 'Seleccionar archivo...'}
          </label>
        </div>

        {progress > 0 && (
          <div className={styles.progressContainer}>
            <progress value={progress} max="100" className={styles.progressBar}></progress>
            <span className={styles.progressText}>{progress}%</span>
          </div>
        )}
        {error && <p className={styles.errorText}>{error}</p>}
        <button type="submit" disabled={isUploading || !file} className={styles.uploadButton}>
          {isUploading ? `Subiendo... ${progress}%` : 'Subir Video'}
        </button>
      </form>
    </div>
  );
}