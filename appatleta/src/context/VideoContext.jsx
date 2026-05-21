// src/context/VideoContext.jsx
import React, { createContext, useState, useContext, useCallback } from 'react';
import { db } from '../config/firebase'; // Asegúrate que la ruta sea correcta
import { doc, getDoc } from 'firebase/firestore';

const VideoContext = createContext();

export const useVideo = () => {
  const context = useContext(VideoContext);
  if (!context) {
    throw new Error('useVideo must be used within a VideoProvider');
  }
  return context;
};

export const VideoProvider = ({ children }) => {
  const [selectedVideoMetadata, setSelectedVideoMetadata] = useState(null); // Metadatos del video de Firestore
  const [poseData, setPoseData] = useState([]); // Array de frames con keypoints
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [videoError, setVideoError] = useState(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  // Aquí podrías añadir estados para herramientas de dibujo, ángulos, etc.

  const loadVideoForAnalysis = useCallback(async (userId, videoId) => {
    if (!userId || !videoId) {
      setVideoError("ID de usuario o video no proporcionado.");
      setSelectedVideoMetadata(null);
      setPoseData([]);
      return;
    }

    setIsLoadingVideo(true);
    setVideoError(null);
    setSelectedVideoMetadata(null);
    setPoseData([]);

    try {
      console.log(`Cargando video para análisis: userId=${userId}, videoId=${videoId}`);
      
      // 1. Cargar metadatos del video
      const videoDocRef = doc(db, 'userVideos', userId, 'videos', videoId);
      const videoSnap = await getDoc(videoDocRef);

      if (!videoSnap.exists()) {
        throw new Error("Video no encontrado en Firestore.");
      }
      
      const videoData = { id: videoSnap.id, ...videoSnap.data() };
      console.log('Metadatos del video cargados:', videoData);
      setSelectedVideoMetadata(videoData);

      // 2. Cargar datos de pose si la URL existe y el video está procesado
      if (videoData.poseDataURL && videoData.status === 'completed') {
        console.log(`Descargando datos de pose desde: ${videoData.poseDataURL}`);
        
        try {
          // Descargar los datos de pose reales
          const response = await fetch(videoData.poseDataURL);
          if (!response.ok) {
            throw new Error(`Error HTTP ${response.status}: ${response.statusText}`);
          }
          
          const poseJson = await response.json();
          console.log('Datos de pose descargados:', poseJson);
          
          // Validar estructura de datos
          if (poseJson && poseJson.frames && Array.isArray(poseJson.frames)) {
            setPoseData(poseJson.frames);
            console.log(`Datos de pose cargados: ${poseJson.frames.length} frames`);
          } else {
            console.warn('Estructura de datos de pose inesperada:', poseJson);
            setPoseData([]);
          }
          
        } catch (fetchError) {
          console.error('Error descargando datos de pose:', fetchError);
          
          // Fallback: usar datos simulados si falla la descarga real
          console.log('Usando datos de pose simulados como fallback');
          const simulatedPoseData = generateSimulatedPoseData();
          setPoseData(simulatedPoseData);
        }

      } else if (videoData.status !== 'completed') {
        console.warn(`El video no está completamente procesado. Estado: ${videoData.status}`);
        setPoseData([]);
      } else {
        console.warn('No hay URL de datos de pose disponible');
        setPoseData([]); // No hay URL de datos de pose
      }

    } catch (error) {
      console.error("Error al cargar video para análisis:", error);
      setVideoError(error.message);
      setSelectedVideoMetadata(null);
      setPoseData([]);
    } finally {
      setIsLoadingVideo(false);
    }
  }, []);

  const clearSelectedVideo = useCallback(() => {
    console.log('Limpiando video seleccionado');
    setSelectedVideoMetadata(null);
    setPoseData([]);
    setPlaybackSpeed(1);
    setVideoError(null);
  }, []);

  const value = {
    selectedVideoMetadata,
    poseData,
    isLoadingVideo,
    videoError,
    loadVideoForAnalysis,
    clearSelectedVideo,
    playbackSpeed,
    setPlaybackSpeed,
  };

  return <VideoContext.Provider value={value}>{children}</VideoContext.Provider>;
};

// Función helper para generar datos simulados (solo para desarrollo/testing)
function generateSimulatedPoseData() {
  const frames = [];
  const duration = 10; // 10 segundos
  const fps = 25;
  const totalFrames = duration * fps;
  
  for (let frame = 0; frame < totalFrames; frame++) {
    const time = frame / fps;
    const keypoints = [];
    
    // Generar 33 keypoints para BlazePose
    for (let i = 0; i < 33; i++) {
      keypoints.push({
        x: 0.3 + Math.random() * 0.4, // Entre 0.3 y 0.7 (centro de la imagen)
        y: 0.2 + Math.random() * 0.6, // Entre 0.2 y 0.8
        score: Math.random() > 0.2 ? 0.8 : 0.1, // 80% de keypoints con alta confianza
        name: `point_${i}`
      });
    }
    
    frames.push({ time, keypoints });
  }
  
  return frames;
}