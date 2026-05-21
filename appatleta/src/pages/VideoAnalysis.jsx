// src/pages/VideoAnalysis.jsx

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useVideo } from '../context/VideoContext';
import styles from '../styles/VideoAnalysis.module.css';

// Definición de conexiones para BlazePose (33 keypoints)
const BLAZEPOSE_CONNECTIONS = [
  // Cabeza
  [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8],
  // Torso
  [9, 10],
  // Brazos
  [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
  // Piernas
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [27, 29], [27, 31],
  [24, 26], [26, 28], [28, 30], [28, 32]
];

// Grupos de keypoints para diferentes análisis
const KEYPOINT_GROUPS = {
  HEAD: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  TORSO: [11, 12, 23, 24],
  LEFT_ARM: [11, 13, 15, 17, 19, 21],
  RIGHT_ARM: [12, 14, 16, 18, 20, 22],
  LEFT_LEG: [23, 25, 27, 29, 31],
  RIGHT_LEG: [24, 26, 28, 30, 32]
};

// Puntos de interés para análisis de carrera
const RUNNING_KEYPOINTS = {
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  NOSE: 0
};

// Paleta de colores validada
const COLOR_PALETTE = {
  PRIMARY: '#00FFFF',      // Cyan/Aqua
  SECONDARY: '#32CD32',    // LimeGreen
  ACCENT: '#FFD700',       // Gold
  WARNING: '#FF6B6B',      // Red
  SUCCESS: '#4ECDC4',      // Teal
  INFO: '#45B7D1',         // Blue
  WHITE: '#FFFFFF',
  BLACK: '#000000',
  TRANSPARENT: 'rgba(255, 255, 255, 0.8)'
};

// Constante de conversión pixels a metros (asumiendo altura promedio de atleta)
const PIXELS_TO_METERS_RATIO = 1.75 / 350; // 1.75m de altura en 350px aproximadamente

export default function VideoAnalysis() {
  const { videoId } = useParams();
  const navigate = useNavigate();  
  const { user } = useAuth();
  const { 
    selectedVideoMetadata, 
    poseData, 
    isLoadingVideo, 
    videoError, 
    loadVideoForAnalysis,
    clearSelectedVideo,
    playbackSpeed,
    setPlaybackSpeed
  } = useVideo();

  // Referencias
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const magnifierCanvasRef = useRef(null);
  const containerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const offscreenCanvasRef = useRef(null);
  const trajectoryPointsRef = useRef({});
  
  // Estados principales
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [videoLoadError, setVideoLoadError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Estados de análisis avanzado
  const [analysisMode, setAnalysisMode] = useState('full');
  const [selectedKeypoint, setSelectedKeypoint] = useState(RUNNING_KEYPOINTS.RIGHT_ANKLE);
  
  // Estados de lupa profesional mejorados
  const [showMagnifier, setShowMagnifier] = useState(false);
  const [magnifierPosition, setMagnifierPosition] = useState({ x: 0, y: 0 });
  const [magnifierSize, setMagnifierSize] = useState(150);
  const [magnifierZoom, setMagnifierZoom] = useState(3);
  const [magnifierFollowMouse, setMagnifierFollowMouse] = useState(true);
  const [magnifierCrosshairs, setMagnifierCrosshairs] = useState(true);
  const [magnifierGrid, setMagnifierGrid] = useState(false);
  
  // Estados de visualización
  const [skeletonOpacity, setSkeletonOpacity] = useState(1);
  const [showKeypoints, setShowKeypoints] = useState(true);
  const [showConnections, setShowConnections] = useState(true);
  const [showTrajectories, setShowTrajectories] = useState(true);
  const [trajectoryLength, setTrajectoryLength] = useState(50);
  const [focusGroup, setFocusGroup] = useState('FULL');
  const [showSkeleton, setShowSkeleton] = useState(true);
  
  // Estados de medición profesional en metros
  const [measurements, setMeasurements] = useState([]);
  const [measurementMode, setMeasurementMode] = useState(false);
  const [measurementPoints, setMeasurementPoints] = useState([]);
  const [measurementUnit, setMeasurementUnit] = useState('meters');
  const [referenceHeight, setReferenceHeight] = useState(1.75);
  const [calibrationMode, setCalibrationMode] = useState(false);
  const [calibrationPoints, setCalibrationPoints] = useState([]);
  const pixelsPerMeterRef = useRef(350 / 1.75);
  
  // Estados de anotaciones profesionales
  const [annotations, setAnnotations] = useState([]);
  const [annotationMode, setAnnotationMode] = useState(false);
  const [selectedAnnotation, setSelectedAnnotation] = useState(null);
  const [annotationColor, setAnnotationColor] = useState(COLOR_PALETTE.WARNING);
  const [annotationSize, setAnnotationSize] = useState('medium');
  const [showAnnotationNumbers, setShowAnnotationNumbers] = useState(true);
  
  // Estados de captura de frames profesional
  const [capturedFrames, setCapturedFrames] = useState([]);
  const [frameCaptureName, setFrameCaptureName] = useState('');
  const [frameAnalysisNotes, setFrameAnalysisNotes] = useState('');
  const [showCaptureOverlay, setShowCaptureOverlay] = useState(false);
  const [captureQuality, setCaptureQuality] = useState('high');
  const [includeSkeletonInCapture, setIncludeSkeletonInCapture] = useState(true);
  
  // Estados de cálculo de ángulos
  const [angleMode, setAngleMode] = useState(false);
  const [anglePoints, setAnglePoints] = useState([]);
  const [calculatedAngles, setCalculatedAngles] = useState([]);
  const [showAngles, setShowAngles] = useState(true);
  const [anglePresets, setAnglePresets] = useState({
    kneeAngle: { name: 'Ángulo de Rodilla', points: [] },
    trunkInclination: { name: 'Inclinación del Tronco', points: [] },
    ankleAngle: { name: 'Ángulo del Tobillo', points: [] }
  });
  
  // Estados de comparación temporal
  const [compareMode, setCompareMode] = useState(false);
  const [compareFrames, setCompareFrames] = useState([]);
  
  // Estado de interfaz
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
  const [activePanel, setActivePanel] = useState('analysis');
  const [deviceType, setDeviceType] = useState('desktop');

  // Detectar tipo de dispositivo al cargar
  useEffect(() => {
    const detectDevice = () => {
      const width = window.innerWidth;
      if (width <= 480) setDeviceType('mobile');
      else if (width <= 768) setDeviceType('tablet');
      else setDeviceType('desktop');
    };

    detectDevice();
    window.addEventListener('resize', detectDevice);
    return () => window.removeEventListener('resize', detectDevice);
  }, []);

  // Función utilitaria para validar colores
  const validateColor = useCallback((color) => {
    // Si el color contiene caracteres no válidos, usar color por defecto
    if (typeof color !== 'string' || /[^a-zA-Z0-9#(),.\s%]/g.test(color)) {
      return COLOR_PALETTE.PRIMARY;
    }
    return color;
  }, []);

  // Función para crear gradientes seguros
  const createSafeGradient = useCallback((ctx, x1, y1, x2, y2, colorStops) => {
    try {
      const gradient = ctx.createRadialGradient(x1, y1, 0, x2, y2, Math.abs(x2 - x1) + Math.abs(y2 - y1) || 10);
      colorStops.forEach(({ offset, color }) => {
        const safeColor = validateColor(color);
        gradient.addColorStop(Math.max(0, Math.min(1, offset)), safeColor);
      });
      return gradient;
    } catch (error) {
      console.warn('Error creating gradient, using fallback color:', error);
      return COLOR_PALETTE.PRIMARY;
    }
  }, [validateColor]);

  // Función para convertir pixels a metros
  const convertPixelsToMeters = useCallback((pixels) => {
    return (pixels / pixelsPerMeterRef.current).toFixed(3);
  }, []);

  // Función para calcular ángulos
  const calculateAngle = useCallback((point1, point2, point3) => {
    const vector1 = {
      x: point1.x - point2.x,
      y: point1.y - point2.y
    };
    const vector2 = {
      x: point3.x - point2.x,
      y: point3.y - point2.y
    };
    
    const dotProduct = vector1.x * vector2.x + vector1.y * vector2.y;
    const magnitude1 = Math.sqrt(vector1.x * vector1.x + vector1.y * vector1.y);
    const magnitude2 = Math.sqrt(vector2.x * vector2.x + vector2.y * vector2.y);
    
    const cosAngle = dotProduct / (magnitude1 * magnitude2);
    const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * (180 / Math.PI);
    
    return angle;
  }, []);

  // Función para obtener ángulos predefinidos automáticamente
  const getAutomaticAngles = useCallback((keypoints, canvasWidth, canvasHeight) => {
    if (!keypoints || !Array.isArray(keypoints)) return [];
    
    const angles = [];
    
    // Ángulo de rodilla izquierda (cadera-rodilla-tobillo)
    const leftHip = keypoints[RUNNING_KEYPOINTS.LEFT_HIP];
    const leftKnee = keypoints[RUNNING_KEYPOINTS.LEFT_KNEE];
    const leftAnkle = keypoints[RUNNING_KEYPOINTS.LEFT_ANKLE];
    
    if (leftHip && leftKnee && leftAnkle && 
        leftHip.score > 0.5 && leftKnee.score > 0.5 && leftAnkle.score > 0.5) {
      const point1 = { x: leftHip.x * canvasWidth, y: leftHip.y * canvasHeight };
      const point2 = { x: leftKnee.x * canvasWidth, y: leftKnee.y * canvasHeight };
      const point3 = { x: leftAnkle.x * canvasWidth, y: leftAnkle.y * canvasHeight };
      
      angles.push({
        name: 'Rodilla Izquierda',
        angle: calculateAngle(point1, point2, point3),
        points: [point1, point2, point3],
        color: COLOR_PALETTE.WARNING
      });
    }
    
    // Ángulo de rodilla derecha
    const rightHip = keypoints[RUNNING_KEYPOINTS.RIGHT_HIP];
    const rightKnee = keypoints[RUNNING_KEYPOINTS.RIGHT_KNEE];
    const rightAnkle = keypoints[RUNNING_KEYPOINTS.RIGHT_ANKLE];
    
    if (rightHip && rightKnee && rightAnkle && 
        rightHip.score > 0.5 && rightKnee.score > 0.5 && rightAnkle.score > 0.5) {
      const point1 = { x: rightHip.x * canvasWidth, y: rightHip.y * canvasHeight };
      const point2 = { x: rightKnee.x * canvasWidth, y: rightKnee.y * canvasHeight };
      const point3 = { x: rightAnkle.x * canvasWidth, y: rightAnkle.y * canvasHeight };
      
      angles.push({
        name: 'Rodilla Derecha',
        angle: calculateAngle(point1, point2, point3),
        points: [point1, point2, point3],
        color: COLOR_PALETTE.ACCENT
      });
    }
    
    // Inclinación del tronco (punto medio caderas - punto medio hombros - vertical)
    const leftShoulder = keypoints[11];
    const rightShoulder = keypoints[12];
    
    if (leftHip && rightHip && leftShoulder && rightShoulder &&
        leftHip.score > 0.5 && rightHip.score > 0.5 && 
        leftShoulder.score > 0.5 && rightShoulder.score > 0.5) {
      
      const hipMidpoint = {
        x: ((leftHip.x + rightHip.x) / 2) * canvasWidth,
        y: ((leftHip.y + rightHip.y) / 2) * canvasHeight
      };
      const shoulderMidpoint = {
        x: ((leftShoulder.x + rightShoulder.x) / 2) * canvasWidth,
        y: ((leftShoulder.y + rightShoulder.y) / 2) * canvasHeight
      };
      const verticalReference = {
        x: hipMidpoint.x,
        y: hipMidpoint.y - 100
      };
      
      angles.push({
        name: 'Inclinación del Tronco',
        angle: calculateAngle(shoulderMidpoint, hipMidpoint, verticalReference),
        points: [shoulderMidpoint, hipMidpoint, verticalReference],
        color: COLOR_PALETTE.SUCCESS
      });
    }
    
    return angles;
  }, [calculateAngle]);

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      clearSelectedVideo();
    };
  }, [clearSelectedVideo]);
  
  // Cargar video cuando cambie el usuario o videoId
  useEffect(() => {
    if (user?.uid && videoId) {
      console.log(`Iniciando carga de video: ${videoId} para usuario: ${user.uid}`);
      loadVideoForAnalysis(user.uid, videoId);
    }
  }, [user, videoId, loadVideoForAnalysis]);

  // Manejar configuración del video
  useEffect(() => {
    const videoElement = videoRef.current;
    
    if (!videoElement || !selectedVideoMetadata?.processedURL) {
      return;
    }

    console.log('Configurando video element con URL:', selectedVideoMetadata.processedURL);
    
    // Eliminado el crossOrigin para evitar problemas de CORS en reproducción
    // Si necesitas captureFrame, configura CORS en Firebase Storage
    
    const handleVideoError = (e) => {
      console.error('Error cargando video:', e);
      console.error('Video error details:', videoElement.error);
      setVideoLoadError('No se pudo cargar el video. Verifique la URL o permisos.');
    };
    
    const handleVideoCanPlay = () => {
      console.log('Video listo para reproducir');
      setVideoLoadError(null);
    };
    
    const handleVideoLoadStart = () => {
      console.log('Iniciando carga del video');
      setVideoLoadError(null);
    };
    
    videoElement.addEventListener('error', handleVideoError);
    videoElement.addEventListener('canplay', handleVideoCanPlay);
    videoElement.addEventListener('loadstart', handleVideoLoadStart);
    
    return () => {
      videoElement.removeEventListener('error', handleVideoError);
      videoElement.removeEventListener('canplay', handleVideoCanPlay);
      videoElement.removeEventListener('loadstart', handleVideoLoadStart);
    };
  }, [selectedVideoMetadata]);

  // Funciones de dibujo mejoradas y corregidas
  const drawKeypoints = useCallback((ctx, keypoints, canvasWidth, canvasHeight, options = {}) => {
    if (!keypoints || !Array.isArray(keypoints) || !ctx) return;
    
    const {
      showNumbers = true,
      highlightGroup = null,
      opacity = 1,
      size = deviceType === 'mobile' ? 6 : 4,
      minScore = 0.4
    } = options;

    const originalAlpha = ctx.globalAlpha;
    ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
    
    keypoints.forEach((keypoint, index) => {
      if (!keypoint || typeof keypoint.score !== 'number' || keypoint.score <= minScore) {
        return;
      }

      const x = Math.max(0, Math.min(canvasWidth, keypoint.x * canvasWidth));
      const y = Math.max(0, Math.min(canvasHeight, keypoint.y * canvasHeight));
      
      // Determinar color basado en el grupo
      let baseColor = COLOR_PALETTE.PRIMARY;
      if (highlightGroup && highlightGroup.includes(index)) {
        baseColor = COLOR_PALETTE.WARNING;
      } else if (index === selectedKeypoint) {
        baseColor = COLOR_PALETTE.ACCENT;
      }
      
      try {
        // Dibujar punto con efecto de brillo usando gradiente seguro
        const gradient = createSafeGradient(ctx, x, y, x, y, [
          { offset: 0, color: baseColor },
          { offset: 1, color: baseColor + '66' }
        ]);
        
        ctx.beginPath();
        ctx.arc(x, y, size, 0, 2 * Math.PI);
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Borde exterior
        ctx.beginPath();
        ctx.arc(x, y, size, 0, 2 * Math.PI);
        ctx.strokeStyle = COLOR_PALETTE.WHITE;
        ctx.lineWidth = deviceType === 'mobile' ? 2 : 1;
        ctx.stroke();
        
        // Mostrar números si está habilitado
        if (showNumbers && keypoint.score > 0.7) {
          ctx.fillStyle = COLOR_PALETTE.WHITE;
          ctx.font = `bold ${deviceType === 'mobile' ? '12px' : '10px'} Arial`;
          ctx.strokeStyle = COLOR_PALETTE.BLACK;
          ctx.lineWidth = deviceType === 'mobile' ? 3 : 2;
          const text = index.toString();
          const offsetX = deviceType === 'mobile' ? 8 : 6;
          const offsetY = deviceType === 'mobile' ? -8 : -6;
          ctx.strokeText(text, x + offsetX, y + offsetY);
          ctx.fillText(text, x + offsetX, y + offsetY);
        }
      } catch (drawError) {
        console.warn(`Error dibujando keypoint ${index}:`, drawError);
        // Fallback simple
        ctx.beginPath();
        ctx.arc(x, y, size, 0, 2 * Math.PI);
        ctx.fillStyle = baseColor;
        ctx.fill();
      }
    });
    
    ctx.globalAlpha = originalAlpha;
  }, [selectedKeypoint, validateColor, createSafeGradient, deviceType]);

  const drawConnections = useCallback((ctx, keypoints, connections, canvasWidth, canvasHeight, options = {}) => {
    if (!keypoints || !Array.isArray(keypoints) || !connections || !ctx) return;
    
    const {
      opacity = 1,
      lineWidth = deviceType === 'mobile' ? 3 : 2,
      highlightGroup = null,
      animated = false
    } = options;

    const originalAlpha = ctx.globalAlpha;
    const originalLineWidth = ctx.lineWidth;
    
    ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
    ctx.lineWidth = Math.max(1, lineWidth);
    
    connections.forEach((pair, index) => {
      if (!Array.isArray(pair) || pair.length < 2) return;
      
      const [kp1Index, kp2Index] = pair;
      
      if (kp1Index >= keypoints.length || kp2Index >= keypoints.length || 
          kp1Index < 0 || kp2Index < 0) return;
      
      const kp1 = keypoints[kp1Index];
      const kp2 = keypoints[kp2Index];
      
      if (!kp1 || !kp2 || kp1.score <= 0.4 || kp2.score <= 0.4) return;
      
      const x1 = Math.max(0, Math.min(canvasWidth, kp1.x * canvasWidth));
      const y1 = Math.max(0, Math.min(canvasHeight, kp1.y * canvasHeight));
      const x2 = Math.max(0, Math.min(canvasWidth, kp2.x * canvasWidth));
      const y2 = Math.max(0, Math.min(canvasHeight, kp2.y * canvasHeight));
      
      // Determinar color de la conexión
      let strokeColor = COLOR_PALETTE.SECONDARY;
      if (highlightGroup && (highlightGroup.includes(kp1Index) || highlightGroup.includes(kp2Index))) {
        strokeColor = COLOR_PALETTE.WARNING;
      }
      
      // Efecto animado opcional
      if (animated) {
        const time = Date.now() * 0.005;
        const alpha = (Math.sin(time + index) + 1) * 0.3 + 0.4;
        ctx.globalAlpha = Math.max(0, Math.min(1, opacity * alpha));
      }
      
      try {
        // Crear gradiente lineal seguro
        const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
        const safeStrokeColor = validateColor(strokeColor);
        gradient.addColorStop(0, safeStrokeColor);
        gradient.addColorStop(1, safeStrokeColor + '88');
        
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = gradient;
        ctx.stroke();
      } catch (gradientError) {
        console.warn(`Error creando gradiente para conexión ${index}:`, gradientError);
        // Fallback sin gradiente
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = validateColor(strokeColor);
        ctx.stroke();
      }
    });
    
    ctx.globalAlpha = originalAlpha;
    ctx.lineWidth = originalLineWidth;
  }, [validateColor, deviceType]);
  
  const drawTrajectory = useCallback((ctx, points, canvasWidth, canvasHeight, options = {}) => {
    if (!points || !Array.isArray(points) || points.length < 2 || !ctx) return;
    
    const {
      color = COLOR_PALETTE.WARNING + 'CC',
      lineWidth = deviceType === 'mobile' ? 4 : 3,
      showDots = true,
      fade = true
    } = options;
    
    const originalLineWidth = ctx.lineWidth;
    const originalAlpha = ctx.globalAlpha;
    
    ctx.lineWidth = Math.max(1, lineWidth);
    
    try {
      // Dibujar línea de trayectoria
      ctx.beginPath();
      
      const firstPoint = points[0];
      const x1 = Math.max(0, Math.min(canvasWidth, firstPoint.x * canvasWidth));
      const y1 = Math.max(0, Math.min(canvasHeight, firstPoint.y * canvasHeight));
      ctx.moveTo(x1, y1);
      
      for (let i = 1; i < points.length; i++) {
        const point = points[i];
        const x = Math.max(0, Math.min(canvasWidth, point.x * canvasWidth));
        const y = Math.max(0, Math.min(canvasHeight, point.y * canvasHeight));
        ctx.lineTo(x, y);
      }
      
      if (fade && points.length > 1) {
        // Crear gradiente que se desvanece
        const lastPoint = points[points.length - 1];
        const x2 = Math.max(0, Math.min(canvasWidth, lastPoint.x * canvasWidth));
        const y2 = Math.max(0, Math.min(canvasHeight, lastPoint.y * canvasHeight));
        
        const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
        const safeColor = validateColor(color);
        gradient.addColorStop(0, safeColor.replace(/[\d.]+\)$/, '0.1)') || (safeColor + '1A'));
        gradient.addColorStop(1, safeColor);
        ctx.strokeStyle = gradient;
      } else {
        ctx.strokeStyle = validateColor(color);
      }
      
      ctx.stroke();
      
      // Dibujar puntos individuales
      if (showDots) {
        const dotSize = deviceType === 'mobile' ? 3 : 2;
        points.forEach((point, index) => {
          const alpha = fade ? (index / points.length) * 0.8 + 0.2 : 1;
          ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
          
          const x = Math.max(0, Math.min(canvasWidth, point.x * canvasWidth));
          const y = Math.max(0, Math.min(canvasHeight, point.y * canvasHeight));
          
          ctx.beginPath();
          ctx.arc(x, y, dotSize, 0, 2 * Math.PI);
          ctx.fillStyle = validateColor(color);
          ctx.fill();
        });
      }
    } catch (trajectoryError) {
      console.warn('Error dibujando trayectoria:', trajectoryError);
    }
    
    ctx.lineWidth = originalLineWidth;
    ctx.globalAlpha = originalAlpha;
  }, [validateColor, deviceType]);

  // Nueva función para dibujar magnifier profesional
  const drawMagnifier = useCallback((ctx, sourceCanvas, centerX, centerY) => {
    if (!showMagnifier || !magnifierCanvasRef.current || !sourceCanvas) return;

    try {
      const magnifierCtx = magnifierCanvasRef.current.getContext('2d');
      if (!magnifierCtx) return;
      
      const magnifierRadius = magnifierSize / 2;
      
      // Limpiar canvas del magnifier
      magnifierCtx.clearRect(0, 0, magnifierSize, magnifierSize);
      
      // Crear círculo de recorte
      magnifierCtx.save();
      magnifierCtx.beginPath();
      magnifierCtx.arc(magnifierRadius, magnifierRadius, magnifierRadius - 5, 0, 2 * Math.PI);
      magnifierCtx.clip();
      
      // Calcular área a magnificar
      const sourceSize = magnifierRadius / magnifierZoom;
      const sourceX = Math.max(0, centerX - sourceSize);
      const sourceY = Math.max(0, centerY - sourceSize);
      
      // Dibujar imagen magnificada
      magnifierCtx.drawImage(
        sourceCanvas,
        sourceX, sourceY, sourceSize * 2, sourceSize * 2,
        0, 0, magnifierSize, magnifierSize
      );
      
      magnifierCtx.restore();
      
      // Dibujar grid si está habilitado
      if (magnifierGrid) {
        magnifierCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        magnifierCtx.lineWidth = 1;
        const gridSize = magnifierSize / 10;
        
        for (let i = 0; i <= 10; i++) {
          const pos = i * gridSize;
          magnifierCtx.beginPath();
          magnifierCtx.moveTo(0, pos);
          magnifierCtx.lineTo(magnifierSize, pos);
          magnifierCtx.stroke();
        }
      }
      
      // Dibujar borde del magnifier
      magnifierCtx.beginPath();
      magnifierCtx.arc(magnifierRadius, magnifierRadius, magnifierRadius - 2, 0, 2 * Math.PI);
      magnifierCtx.strokeStyle = COLOR_PALETTE.WHITE;
      magnifierCtx.lineWidth = 4;
      magnifierCtx.stroke();
      
      magnifierCtx.beginPath();
      magnifierCtx.arc(magnifierRadius, magnifierRadius, magnifierRadius - 2, 0, 2 * Math.PI);
      magnifierCtx.strokeStyle = COLOR_PALETTE.BLACK;
      magnifierCtx.lineWidth = 2;
      magnifierCtx.stroke();
      
      // Dibujar crosshairs si está habilitado
      if (magnifierCrosshairs) {
        magnifierCtx.strokeStyle = COLOR_PALETTE.WARNING;
        magnifierCtx.lineWidth = deviceType === 'mobile' ? 2 : 1;
        const crossSize = deviceType === 'mobile' ? 15 : 10;
        magnifierCtx.beginPath();
        magnifierCtx.moveTo(magnifierRadius - crossSize, magnifierRadius);
        magnifierCtx.lineTo(magnifierRadius + crossSize, magnifierRadius);
        magnifierCtx.moveTo(magnifierRadius, magnifierRadius - crossSize);
        magnifierCtx.lineTo(magnifierRadius, magnifierRadius + crossSize);
        magnifierCtx.stroke();
      }
      
      // Información de zoom
      magnifierCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      magnifierCtx.fillRect(5, 5, 40, 20);
      magnifierCtx.fillStyle = COLOR_PALETTE.WHITE;
      magnifierCtx.font = `bold ${deviceType === 'mobile' ? '10px' : '8px'} Arial`;
      magnifierCtx.fillText(`${magnifierZoom}x`, 8, 17);
    } catch (magnifierError) {
      console.warn('Error dibujando magnifier:', magnifierError);
    }
  }, [showMagnifier, magnifierSize, magnifierZoom, magnifierGrid, magnifierCrosshairs, deviceType]);

  // Función para dibujar mediciones profesionales en metros
  const drawMeasurements = useCallback((ctx, measurements, canvasWidth, canvasHeight) => {
    if (!measurements || !Array.isArray(measurements) || !ctx) return;
    
    const originalLineWidth = ctx.lineWidth;
    const originalFont = ctx.font;
    
    measurements.forEach((measurement, index) => {
      if (!measurement?.points || !Array.isArray(measurement.points) || measurement.points.length < 2) {
        return;
      }
      
      try {
        const [point1, point2] = measurement.points;
        const x1 = Math.max(0, Math.min(canvasWidth, point1.x * canvasWidth));
        const y1 = Math.max(0, Math.min(canvasHeight, point1.y * canvasHeight));
        const x2 = Math.max(0, Math.min(canvasWidth, point2.x * canvasWidth));
        const y2 = Math.max(0, Math.min(canvasHeight, point2.y * canvasHeight));
        
        // Dibujar línea de medición
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = COLOR_PALETTE.ACCENT;
        ctx.lineWidth = deviceType === 'mobile' ? 3 : 2;
        ctx.stroke();
        
        // Dibujar puntos de medición
        const pointSize = deviceType === 'mobile' ? 6 : 4;
        [point1, point2].forEach(point => {
          const x = Math.max(0, Math.min(canvasWidth, point.x * canvasWidth));
          const y = Math.max(0, Math.min(canvasHeight, point.y * canvasHeight));
          ctx.beginPath();
          ctx.arc(x, y, pointSize, 0, 2 * Math.PI);
          ctx.fillStyle = COLOR_PALETTE.ACCENT;
          ctx.fill();
          ctx.strokeStyle = COLOR_PALETTE.WHITE;
          ctx.lineWidth = 1;
          ctx.stroke();
        });
        
        // Calcular y mostrar distancia
        const distancePixels = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        const distanceMeters = convertPixelsToMeters(distancePixels);
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        
        // Etiqueta de fondo
        const text = measurementUnit === 'meters' ? `${distanceMeters}m` : `${distancePixels.toFixed(1)}px`;
        const textWidth = ctx.measureText(text).width;
        const padding = deviceType === 'mobile' ? 8 : 6;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(midX - textWidth/2 - padding, midY - 20, textWidth + padding*2, 20);
        
        ctx.fillStyle = COLOR_PALETTE.WHITE;
        ctx.font = `bold ${deviceType === 'mobile' ? '14px' : '12px'} Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(text, midX, midY - 5);
        ctx.textAlign = 'left';
        
        // Mostrar número de medición
        ctx.fillStyle = COLOR_PALETTE.ACCENT;
        ctx.font = `bold ${deviceType === 'mobile' ? '12px' : '10px'} Arial`;
        ctx.fillText(`#${index + 1}`, x1 + 10, y1 - 5);
      } catch (measurementError) {
        console.warn(`Error dibujando medición ${index}:`, measurementError);
      }
    });
    
    ctx.lineWidth = originalLineWidth;
    ctx.font = originalFont;
  }, [convertPixelsToMeters, measurementUnit, deviceType]);

  // Función para dibujar anotaciones profesionales
  const drawAnnotations = useCallback((ctx, annotations, canvasWidth, canvasHeight) => {
    if (!annotations || !Array.isArray(annotations) || !ctx) return;
    
    const originalFont = ctx.font;
    const originalTextAlign = ctx.textAlign;
    
    annotations.forEach((annotation, index) => {
      if (!annotation || typeof annotation.x !== 'number' || typeof annotation.y !== 'number') {
        return;
      }
      
      try {
        const x = Math.max(0, Math.min(canvasWidth, annotation.x * canvasWidth));
        const y = Math.max(0, Math.min(canvasHeight, annotation.y * canvasHeight));
        
        // Tamaño basado en la configuración
        let markerSize = 8;
        let fontSize = '12px';
        if (annotationSize === 'small') {
          markerSize = 6;
          fontSize = '10px';
        } else if (annotationSize === 'large') {
          markerSize = 12;
          fontSize = '14px';
        }
        
        if (deviceType === 'mobile') {
          markerSize += 4;
          fontSize = fontSize.replace(/\d+/, (match) => parseInt(match) + 2);
        }
        
        const color = annotation.color || annotationColor;
        
        // Dibujar marcador principal
        ctx.beginPath();
        ctx.arc(x, y, markerSize, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = COLOR_PALETTE.WHITE;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Dibujar número si está habilitado
        if (showAnnotationNumbers) {
          ctx.fillStyle = COLOR_PALETTE.WHITE;
          ctx.font = `bold ${deviceType === 'mobile' ? '12px' : '10px'} Arial`;
          ctx.textAlign = 'center';
          ctx.fillText((index + 1).toString(), x, y + 3);
        }
        
        // Dibujar texto de anotación con fondo
        if (annotation.text && typeof annotation.text === 'string') {
          const textX = x + markerSize + 8;
          const textY = y;
          
          ctx.font = `${fontSize} Arial`;
          ctx.textAlign = 'left';
          const textWidth = ctx.measureText(annotation.text).width;
          const padding = 6;
          
          // Fondo del texto
          ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
          ctx.fillRect(textX - padding, textY - 15, textWidth + padding*2, 18);
          
          // Texto
          ctx.fillStyle = COLOR_PALETTE.WHITE;
          ctx.fillText(annotation.text, textX, textY - 3);
          
          // Línea conectora
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x + markerSize, y);
          ctx.lineTo(textX - padding, textY - 6);
          ctx.stroke();
        }
      } catch (annotationError) {
        console.warn(`Error dibujando anotación ${index}:`, annotationError);
      }
    });
    
    ctx.font = originalFont;
    ctx.textAlign = originalTextAlign;
  }, [annotationColor, annotationSize, showAnnotationNumbers, deviceType]);

  // Función para dibujar ángulos
  const drawAngles = useCallback((ctx, angles, canvasWidth, canvasHeight) => {
    if (!angles || !Array.isArray(angles) || !ctx || !showAngles) return;
    
    const originalFont = ctx.font;
    const originalLineWidth = ctx.lineWidth;
    
    angles.forEach((angleData, index) => {
      if (!angleData.points || angleData.points.length < 3) return;
      
      try {
        const [point1, point2, point3] = angleData.points;
        const color = angleData.color || COLOR_PALETTE.INFO;
        
        // Dibujar líneas del ángulo
        ctx.strokeStyle = color;
        ctx.lineWidth = deviceType === 'mobile' ? 3 : 2;
        
        ctx.beginPath();
        ctx.moveTo(point2.x, point2.y);
        ctx.lineTo(point1.x, point1.y);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(point2.x, point2.y);
        ctx.lineTo(point3.x, point3.y);
        ctx.stroke();
        
        // Dibujar arco del ángulo
        const radius = deviceType === 'mobile' ? 30 : 25;
        const angle1 = Math.atan2(point1.y - point2.y, point1.x - point2.x);
        const angle3 = Math.atan2(point3.y - point2.y, point3.x - point2.x);
        
        ctx.beginPath();
        ctx.arc(point2.x, point2.y, radius, angle1, angle3);
        ctx.stroke();
        
        // Mostrar valor del ángulo
        const angleText = `${angleData.angle.toFixed(1)}°`;
        const textX = point2.x + Math.cos((angle1 + angle3) / 2) * (radius + 15);
        const textY = point2.y + Math.sin((angle1 + angle3) / 2) * (radius + 15);
        
        ctx.font = `bold ${deviceType === 'mobile' ? '14px' : '12px'} Arial`;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        const textWidth = ctx.measureText(angleText).width;
        ctx.fillRect(textX - textWidth/2 - 4, textY - 10, textWidth + 8, 16);
        
        ctx.fillStyle = COLOR_PALETTE.WHITE;
        ctx.textAlign = 'center';
        ctx.fillText(angleText, textX, textY + 3);
        ctx.textAlign = 'left';
        
        // Etiqueta del ángulo
        if (angleData.name) {
          ctx.font = `${deviceType === 'mobile' ? '11px' : '9px'} Arial`;
          ctx.fillStyle = color;
          ctx.fillText(angleData.name, textX - textWidth/2, textY - 15);
        }
      } catch (angleError) {
        console.warn(`Error dibujando ángulo ${index}:`, angleError);
      }
    });
    
    ctx.font = originalFont;
    ctx.lineWidth = originalLineWidth;
  }, [showAngles, deviceType]);

  // Función principal de renderizado mejorada
  const renderFrame = useCallback((currentTime) => {
    const canvasElement = canvasRef.current;
    if (!canvasElement || !poseData || !Array.isArray(poseData) || poseData.length === 0) return;

    const ctx = canvasElement.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // Encontrar el frame de pose más cercano
    let closestFrame = null;
    let minDiff = Infinity;
    
    poseData.forEach(frame => {
      if (frame && typeof frame.time === 'number') {
        const diff = Math.abs(frame.time - currentTime);
        if (diff < minDiff) {
          minDiff = diff;
          closestFrame = frame;
        }
      }
    });
    
    // Umbral de tiempo para considerar un frame como "cercano"
    if (closestFrame && minDiff < 0.1 && closestFrame.keypoints) {
      try {
        // Determinar qué grupo resaltar
        let highlightGroup = null;
        if (focusGroup !== 'FULL' && KEYPOINT_GROUPS[focusGroup]) {
          highlightGroup = KEYPOINT_GROUPS[focusGroup];
        }

        // Dibujar según el modo de análisis
        switch (analysisMode) {
          case 'skeleton':
            if (showConnections && showSkeleton) {
              drawConnections(ctx, closestFrame.keypoints, BLAZEPOSE_CONNECTIONS, canvasElement.width, canvasElement.height, {
                opacity: skeletonOpacity,
                highlightGroup,
                animated: false
              });
            }
            if (showKeypoints) {
              drawKeypoints(ctx, closestFrame.keypoints, canvasElement.width, canvasElement.height, {
                highlightGroup,
                opacity: skeletonOpacity
              });
            }
            break;
            
          case 'trajectory':
            // Solo mostrar trayectorias
            Object.values(trajectoryPointsRef.current).forEach((points, index) => {
              if (points && points.length > 1) {
                const hue = (index * 60) % 360;
                const color = `hsl(${hue}, 70%, 50%)`;
                drawTrajectory(ctx, points, canvasElement.width, canvasElement.height, {
                  color,
                  fade: true
                });
              }
            });
            break;
            
          case 'focus':
            // Modo enfocado en puntos específicos
            if (highlightGroup) {
              const focusConnections = BLAZEPOSE_CONNECTIONS.filter(([a, b]) => 
                highlightGroup.includes(a) && highlightGroup.includes(b)
              );
              if (showConnections && showSkeleton) {
                drawConnections(ctx, closestFrame.keypoints, focusConnections, canvasElement.width, canvasElement.height, {
                  opacity: skeletonOpacity,
                  highlightGroup
                });
              }
              
              if (showKeypoints) {
                closestFrame.keypoints.forEach((kp, index) => {
                  if (highlightGroup.includes(index) && kp && kp.score > 0.4) {
                    drawKeypoints(ctx, [kp], canvasElement.width, canvasElement.height, {
                      highlightGroup: [0],
                      size: deviceType === 'mobile' ? 8 : 6
                    });
                  }
                });
              }
            }
            break;
            
          default: // 'full'
            if (showConnections && showSkeleton) {
              drawConnections(ctx, closestFrame.keypoints, BLAZEPOSE_CONNECTIONS, canvasElement.width, canvasElement.height, {
                opacity: skeletonOpacity,
                highlightGroup
              });
            }
            if (showKeypoints) {
              drawKeypoints(ctx, closestFrame.keypoints, canvasElement.width, canvasElement.height, {
                highlightGroup,
                opacity: skeletonOpacity
              });
            }
            break;
        }

        // Actualizar trayectorias para múltiples keypoints
        if (showTrajectories) {
          Object.keys(RUNNING_KEYPOINTS).forEach(keypointName => {
            const keypointIndex = RUNNING_KEYPOINTS[keypointName];
            const trackedKp = closestFrame.keypoints[keypointIndex];
            
            if (trackedKp && trackedKp.score > 0.5) {
              const prev = trajectoryPointsRef.current;
              const newPoints = [...(prev[keypointIndex] || []), { x: trackedKp.x, y: trackedKp.y }];
              trajectoryPointsRef.current = {
                ...prev,
                [keypointIndex]: newPoints.slice(-trajectoryLength)
              };
            }
          });
        }

        // Calcular y actualizar ángulos automáticos
        let anglesToDraw = calculatedAngles;
        if (showAngles) {
          const automaticAngles = getAutomaticAngles(closestFrame.keypoints, canvasElement.width, canvasElement.height);
          anglesToDraw = [...calculatedAngles, ...automaticAngles];
        }

      } catch (drawError) {
        console.error('Error dibujando pose:', drawError);
      }
    }
    
    // Dibujar trayectorias si están habilitadas
    if (showTrajectories && analysisMode !== 'trajectory') {
      Object.entries(trajectoryPointsRef.current).forEach(([keypointIndex, points], index) => {
        if (points && points.length > 1) {
          const hue = (index * 45) % 360;
          const color = `hsl(${hue}, 70%, 50%)`;
          drawTrajectory(ctx, points, canvasElement.width, canvasElement.height, {
            color,
            fade: true
          });
        }
      });
    }

    // Dibujar mediciones
    if (measurements.length > 0) {
      drawMeasurements(ctx, measurements, canvasElement.width, canvasElement.height);
    }

    // Dibujar anotaciones
    if (annotations.length > 0) {
      drawAnnotations(ctx, annotations, canvasElement.width, canvasElement.height);
    }

    // Dibujar ángulos
    if (anglesToDraw.length > 0) {
      drawAngles(ctx, anglesToDraw, canvasElement.width, canvasElement.height);
    }

    // Actualizar magnifier si está activo
    if (showMagnifier) {
      drawMagnifier(ctx, canvasElement, magnifierPosition.x, magnifierPosition.y);
    }
  }, [
    poseData, analysisMode, focusGroup, showConnections, showKeypoints, showTrajectories,
    skeletonOpacity, trajectoryLength, measurements, annotations,
    showMagnifier, magnifierPosition, showAngles, showSkeleton, calculatedAngles,
    drawKeypoints, drawConnections, drawTrajectory, drawMagnifier, drawMeasurements, 
    drawAnnotations, drawAngles, getAutomaticAngles, deviceType
  ]);

  // Efecto principal de renderizado
  useEffect(() => {
    const videoElement = videoRef.current;
    const canvasElement = canvasRef.current;

    if (!videoElement || !canvasElement) {
      return;
    }

    // Limpiar canvas si no hay datos
    if (!poseData || !Array.isArray(poseData) || poseData.length === 0) {
      const ctx = canvasElement.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      }
      trajectoryPointsRef.current = {};
      return;
    }
    
    console.log(`Configurando renderizado de pose con ${poseData.length} frames`);
    
    // Aplicar velocidad de reproducción
    if (videoElement.playbackRate !== playbackSpeed) {
      videoElement.playbackRate = playbackSpeed;
    }

    const renderLoop = () => {
      if (!videoElement || !canvasElement) return;
      
      try {
        const currentTime = videoElement.currentTime;
        renderFrame(currentTime);
        animationFrameRef.current = requestAnimationFrame(renderLoop);
      } catch (renderError) {
        console.error('Error en renderLoop:', renderError);
        // Intentar continuar el renderizado después de un error
        animationFrameRef.current = requestAnimationFrame(renderLoop);
      }
    };

    const handleVideoMetadataLoaded = () => {
      console.log('Video metadata loaded');
      try {
        const width = videoElement.videoWidth || 1280;
        const height = videoElement.videoHeight || 720;
        
        setCanvasSize({ width, height });
        canvasElement.width = width;
        canvasElement.height = height;
        
        // Calcular nueva relación pixels por metro basada en el tamaño real
        const newPixelsPerMeter = height * 0.25; // Asumiendo que la persona ocupa 1/4 de la altura
        pixelsPerMeterRef.current = newPixelsPerMeter;
        
        // Iniciar renderizado
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        renderLoop();
      } catch (metadataError) {
        console.error('Error handling video metadata:', metadataError);
      }
    };
    
    const handleVideoSeeked = () => {
      console.log('Video seeked, clearing trajectory');
      trajectoryPointsRef.current = {};
    };

    const handleVideoPlay = () => {
      console.log('Video started playing');
      if (!animationFrameRef.current) {
        renderLoop();
      }
    };

    const handleVideoPause = () => {
      console.log('Video paused');
      // No cancelar animationFrame para mantener el último frame visible
    };

    // Event listeners
    videoElement.addEventListener('loadedmetadata', handleVideoMetadataLoaded);
    videoElement.addEventListener('play', handleVideoPlay);
    videoElement.addEventListener('pause', handleVideoPause);
    videoElement.addEventListener('seeked', handleVideoSeeked);

    // Iniciar si el video ya está cargado
    if (videoElement.readyState >= 2) {
      handleVideoMetadataLoaded();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      videoElement.removeEventListener('loadedmetadata', handleVideoMetadataLoaded);
      videoElement.removeEventListener('play', handleVideoPlay);
      videoElement.removeEventListener('pause', handleVideoPause);
      videoElement.removeEventListener('seeked', handleVideoSeeked);
    };
  }, [poseData, playbackSpeed, renderFrame]);

  // Manejadores de eventos
  const handleSpeedChange = (event) => {
    const newSpeed = parseFloat(event.target.value);
    console.log(`Cambiando velocidad a: ${newSpeed}x`);
    setPlaybackSpeed(newSpeed);
  };

  const handleCanvasClick = useCallback((event) => {
    if (!canvasRef.current) return;
    
    try {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;

      if (calibrationMode) {
        setCalibrationPoints(prev => {
          const newPoints = [...prev, { x, y }];
          if (newPoints.length === 2) {
            // Calcular nueva calibración
            const point1 = newPoints[0];
            const point2 = newPoints[1];
            const pixelDistance = Math.sqrt(
              Math.pow((point2.x - point1.x) * canvas.width, 2) + 
              Math.pow((point2.y - point1.y) * canvas.height, 2)
            );
            pixelsPerMeterRef.current = pixelDistance / referenceHeight;
            setCalibrationMode(false);
            return [];
          }
          return newPoints;
        });
      } else if (measurementMode) {
        setMeasurementPoints(prev => {
          const newPoints = [...prev, { x, y }];
          if (newPoints.length === 2) {
            setMeasurements(prev => [...prev, { 
              points: newPoints, 
              id: Date.now(),
              timestamp: videoRef.current?.currentTime || 0
            }]);
            return [];
          }
          return newPoints;
        });
      } else if (annotationMode) {
        const text = prompt('Ingrese el texto de la anotación:');
        if (text) {
          setAnnotations(prev => [...prev, { 
            x, 
            y, 
            text, 
            id: Date.now(),
            timestamp: videoRef.current?.currentTime || 0,
            color: annotationColor,
            size: annotationSize
          }]);
        }
      } else if (angleMode) {
        setAnglePoints(prev => {
          const newPoints = [...prev, { x: x * canvas.width, y: y * canvas.height }];
          if (newPoints.length === 3) {
            const angle = calculateAngle(newPoints[0], newPoints[1], newPoints[2]);
            setCalculatedAngles(prev => [...prev, {
              name: 'Ángulo Manual',
              angle,
              points: newPoints,
              color: COLOR_PALETTE.INFO,
              isUserDefined: true,
              id: Date.now()
            }]);
            return [];
          }
          return newPoints;
        });
      }
    } catch (clickError) {
      console.error('Error handling canvas click:', clickError);
    }
  }, [measurementMode, annotationMode, angleMode, calibrationMode, referenceHeight, 
      annotationColor, annotationSize, calculateAngle]);

  const handleCanvasMouseMove = useCallback((event) => {
    if (!canvasRef.current) return;
    
    try {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      if (showMagnifier && magnifierFollowMouse) {
        setMagnifierPosition({ x, y });
      }
    } catch (mouseMoveError) {
      console.error('Error handling mouse move:', mouseMoveError);
    }
  }, [showMagnifier, magnifierFollowMouse]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    
    try {
      const container = containerRef.current;
      if (!document.fullscreenElement) {
        container.requestFullscreen().then(() => {
          setIsFullscreen(true);
        }).catch(err => {
          console.error('Error entering fullscreen:', err);
        });
      } else {
        document.exitFullscreen().then(() => {
          setIsFullscreen(false);
        }).catch(err => {
          console.error('Error exiting fullscreen:', err);
        });
      }
    } catch (fullscreenError) {
      console.error('Error toggling fullscreen:', fullscreenError);
    }
  }, []);

  const resetAnalysis = useCallback(() => {
    try {
      trajectoryPointsRef.current = {};
      setMeasurements([]);
      setAnnotations([]);
      setCompareFrames([]);
      setCapturedFrames([]);
      setCalculatedAngles([]);
      console.log('Analysis reset completed');
    } catch (resetError) {
      console.error('Error resetting analysis:', resetError);
    }
  }, []);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas) return;
    
    try {
      const currentTime = video.currentTime;
      
      // Crear canvas temporal para la captura
      const captureCanvas = document.createElement('canvas');
      const captureCtx = captureCanvas.getContext('2d');
      captureCanvas.width = canvas.width;
      captureCanvas.height = canvas.height;
      
      // Dibujar video
      captureCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Dibujar overlay del análisis si está habilitado
      if (includeSkeletonInCapture) {
        captureCtx.drawImage(canvas, 0, 0);
      }
      
      const quality = captureQuality === 'high' ? 1.0 : captureQuality === 'medium' ? 0.8 : 0.6;
      
      const frameData = {
        id: Date.now(),
        time: currentTime,
        name: frameCaptureName || `Frame_${Math.floor(currentTime)}s`,
        notes: frameAnalysisNotes || '',
        imageData: captureCanvas.toDataURL('image/png', quality),
        poseData: poseData?.find(frame => Math.abs(frame.time - currentTime) < 0.1),
        measurements: [...measurements],
        annotations: [...annotations],
        angles: [...calculatedAngles],
        settings: {
          analysisMode,
          focusGroup,
          showSkeleton: includeSkeletonInCapture
        }
      };
      
      setCapturedFrames(prev => [...prev, frameData].slice(-10)); // Máximo 10 frames
      setShowCaptureOverlay(false);
      setFrameCaptureName('');
      setFrameAnalysisNotes('');
    } catch (captureError) {
      console.error('Error capturando frame:', captureError);
    }
  }, [videoRef, canvasRef, poseData, measurements, annotations, calculatedAngles, analysisMode, focusGroup, includeSkeletonInCapture, captureQuality, frameCaptureName, frameAnalysisNotes]);

  // Función para exportar análisis profesional
  const exportAnalysis = useCallback(() => {
    try {
      const analysisData = {
        videoId,
        metadata: selectedVideoMetadata,
        poseData,
        measurements: measurements.map(m => ({
          ...m,
          distanceMeters: convertPixelsToMeters(Math.sqrt(
            Math.pow((m.points[1].x - m.points[0].x) * canvasSize.width, 2) + 
            Math.pow((m.points[1].y - m.points[0].y) * canvasSize.height, 2)
          ))
        })),
        annotations,
        angles: calculatedAngles,
        capturedFrames: capturedFrames.map(f => ({
          ...f,
          imageData: f.imageData.substring(0, 50) + '...' // Reducir tamaño para export
        })),
        settings: {
          pixelsPerMeter: pixelsPerMeterRef.current,
          referenceHeight,
          analysisMode,
          focusGroup,
          trajectoryLength
        }
      };

      const blob = new Blob([JSON.stringify(analysisData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analisis_${videoId}_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      console.error('Error exportando análisis:', exportError);
    }
  }, [videoId, selectedVideoMetadata, poseData, measurements, annotations, calculatedAngles, capturedFrames, 
      canvasSize, convertPixelsToMeters, referenceHeight, analysisMode, focusGroup, trajectoryLength]);

  // Manejar cambio de fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Detectar errores de carga
  if (isLoadingVideo) {
    return <div className={styles.loading}>Cargando video y análisis...</div>;
  }

  if (videoError || videoLoadError) {
    return (
      <div className={styles.error}>
        Error: {videoError || videoLoadError}
        <button onClick={() => navigate('/videos')}>Volver a la lista</button>
      </div>
    );
  }

  if (!selectedVideoMetadata?.processedURL) {
    return (
      <div className={styles.error}>
        No se encontró el video procesado
        <button onClick={() => navigate('/videos')}>Volver</button>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className={`${styles.container} ${isFullscreen ? styles.fullscreen : ''} ${deviceType}`}
      onMouseMove={handleCanvasMouseMove}
    >
      <div className={styles.videoContainer}>
        <video
          ref={videoRef}
          src={selectedVideoMetadata.processedURL}
          className={styles.video}
          controls
          playsInline
          muted={false}
          loop={false}
          style={{ width: `${canvasSize.width}px`, height: `${canvasSize.height}px` }}
          type="video/mp4"
          preload="metadata"
        />
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          width={canvasSize.width}
          height={canvasSize.height}
          onClick={handleCanvasClick}
          style={{ 
            width: `${canvasSize.width}px`, 
            height: `${canvasSize.height}px`,
            pointerEvents: (measurementMode || annotationMode || angleMode || calibrationMode) ? 'auto' : 'none'
          }}
        />
      </div>

      {showMagnifier && (
        <canvas
          ref={magnifierCanvasRef}
          className={styles.magnifier}
          width={magnifierSize}
          height={magnifierSize}
          style={{
            left: `${magnifierPosition.x + 20}px`,
            top: `${magnifierPosition.y + 20}px`,
          }}
        />
      )}

      <div className={`${styles.toolbar} ${toolbarCollapsed ? styles.collapsed : ''}`}>
        <button onClick={() => setToolbarCollapsed(!toolbarCollapsed)}>
          {toolbarCollapsed ? 'Expandir' : 'Colapsar'}
        </button>
        
        {!toolbarCollapsed && (
          <>
            <div className={styles.speedControl}>
              <label>Velocidad:</label>
              <select value={playbackSpeed} onChange={handleSpeedChange}>
                <option value={0.1}>0.1x</option>
                <option value={0.25}>0.25x</option>
                <option value={0.5}>0.5x</option>
                <option value={1}>1x</option>
                <option value={1.5}>1.5x</option>
                <option value={2}>2x</option>
              </select>
            </div>

            <div className={styles.modeSelect}>
              <label>Modo:</label>
              <select value={analysisMode} onChange={(e) => setAnalysisMode(e.target.value)}>
                <option value="full">Completo</option>
                <option value="skeleton">Esqueleto</option>
                <option value="trajectory">Trayectorias</option>
                <option value="focus">Enfoque</option>
              </select>
            </div>

            <div className={styles.focusGroup}>
              <label>Grupo:</label>
              <select value={focusGroup} onChange={(e) => setFocusGroup(e.target.value)}>
                <option value="FULL">Todo</option>
                <option value="HEAD">Cabeza</option>
                <option value="TORSO">Torso</option>
                <option value="LEFT_ARM">Brazo Izq</option>
                <option value="RIGHT_ARM">Brazo Der</option>
                <option value="LEFT_LEG">Pierna Izq</option>
                <option value="RIGHT_LEG">Pierna Der</option>
              </select>
            </div>

            <div className={styles.toggles}>
              <label>
                Esqueleto
                <input type="checkbox" checked={showSkeleton} onChange={(e) => setShowSkeleton(e.target.checked)} />
              </label>
              <label>
                Keypoints
                <input type="checkbox" checked={showKeypoints} onChange={(e) => setShowKeypoints(e.target.checked)} />
              </label>
              <label>
                Conexiones
                <input type="checkbox" checked={showConnections} onChange={(e) => setShowConnections(e.target.checked)} />
              </label>
              <label>
                Trayectorias
                <input type="checkbox" checked={showTrajectories} onChange={(e) => setShowTrajectories(e.target.checked)} />
              </label>
              <label>
                Ángulos
                <input type="checkbox" checked={showAngles} onChange={(e) => setShowAngles(e.target.checked)} />
              </label>
            </div>

            <div className={styles.sliders}>
              <label>
                Opacidad: {skeletonOpacity.toFixed(2)}
                <input 
                  type="range" 
                  min={0} 
                  max={1} 
                  step={0.1} 
                  value={skeletonOpacity} 
                  onChange={(e) => setSkeletonOpacity(parseFloat(e.target.value))} 
                />
              </label>
              <label>
                Longitud Trayectoria: {trajectoryLength}
                <input 
                  type="range" 
                  min={10} 
                  max={200} 
                  value={trajectoryLength} 
                  onChange={(e) => setTrajectoryLength(parseInt(e.target.value))} 
                />
              </label>
            </div>

            <div className={styles.tools}>
              <button onClick={() => setMeasurementMode(!measurementMode)}>
                {measurementMode ? 'Cancelar Medición' : 'Medir Distancia'}
              </button>
              <button onClick={() => setAnnotationMode(!annotationMode)}>
                {annotationMode ? 'Cancelar Anotación' : 'Anotar'}
              </button>
              <button onClick={() => setAngleMode(!angleMode)}>
                {angleMode ? 'Cancelar Ángulo' : 'Medir Ángulo'}
              </button>
              <button onClick={() => setCalibrationMode(!calibrationMode)}>
                {calibrationMode ? 'Cancelar Calibración' : 'Calibrar'}
              </button>
              <button onClick={() => setShowMagnifier(!showMagnifier)}>
                {showMagnifier ? 'Ocultar Lupa' : 'Mostrar Lupa'}
              </button>
            </div>

            <div className={styles.magnifierControls}>
              <label>
                Zoom Lupa: {magnifierZoom}x
                <input 
                  type="range" 
                  min={1.5} 
                  max={10} 
                  step={0.5} 
                  value={magnifierZoom} 
                  onChange={(e) => setMagnifierZoom(parseFloat(e.target.value))} 
                />
              </label>
              <label>
                Tamaño Lupa: {magnifierSize}px
                <input 
                  type="range" 
                  min={100} 
                  max={300} 
                  step={10} 
                  value={magnifierSize} 
                  onChange={(e) => setMagnifierSize(parseInt(e.target.value))} 
                />
              </label>
              <label>
                Seguir Mouse
                <input type="checkbox" checked={magnifierFollowMouse} onChange={(e) => setMagnifierFollowMouse(e.target.checked)} />
              </label>
              <label>
                Crosshairs
                <input type="checkbox" checked={magnifierCrosshairs} onChange={(e) => setMagnifierCrosshairs(e.target.checked)} />
              </label>
              <label>
                Grid
                <input type="checkbox" checked={magnifierGrid} onChange={(e) => setMagnifierGrid(e.target.checked)} />
              </label>
            </div>

            <div className={styles.actions}>
              <button onClick={captureFrame}>Capturar Frame</button>
              <button onClick={exportAnalysis}>Exportar Análisis</button>
              <button onClick={resetAnalysis}>Resetear Análisis</button>
              <button onClick={toggleFullscreen}>
                {isFullscreen ? 'Salir Fullscreen' : 'Fullscreen'}
              </button>
              <button onClick={() => navigate('/videos')}>Volver</button>
            </div>

            <div className={styles.panelSelect}>
              <button onClick={() => setActivePanel('analysis')} className={activePanel === 'analysis' ? styles.active : ''}>Análisis</button>
              <button onClick={() => setActivePanel('measurements')} className={activePanel === 'measurements' ? styles.active : ''}>Mediciones</button>
              <button onClick={() => setActivePanel('annotations')} className={activePanel === 'annotations' ? styles.active : ''}>Anotaciones</button>
              <button onClick={() => setActivePanel('angles')} className={activePanel === 'angles' ? styles.active : ''}>Ángulos</button>
              <button onClick={() => setActivePanel('captures')} className={activePanel === 'captures' ? styles.active : ''}>Capturas</button>
            </div>
          </>
        )}
      </div>

      <div className={styles.sidePanel}>
        {activePanel === 'analysis' && (
          <div>
            <h3>Análisis Actual</h3>
            <p>Modo: {analysisMode}</p>
            <p>Grupo Enfocado: {focusGroup}</p>
            <p>Calibración: {pixelsPerMeterRef.current.toFixed(2)} px/m</p>
            <p>Altura Referencia: {referenceHeight}m</p>
          </div>
        )}

        {activePanel === 'measurements' && (
          <div>
            <h3>Mediciones ({measurements.length})</h3>
            <ul>
              {measurements.map((m, index) => {
                const distPx = Math.sqrt(
                  Math.pow((m.points[1].x - m.points[0].x) * canvasSize.width, 2) + 
                  Math.pow((m.points[1].y - m.points[0].y) * canvasSize.height, 2)
                );
                const distM = convertPixelsToMeters(distPx);
                return (
                  <li key={index}>
                    #{index + 1}: {distM}m ({distPx.toFixed(1)}px) @ {m.timestamp.toFixed(2)}s
                    <button onClick={() => setMeasurements(prev => prev.filter((_, i) => i !== index))}>Eliminar</button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {activePanel === 'annotations' && (
          <div>
            <h3>Anotaciones ({annotations.length})</h3>
            <ul>
              {annotations.map((a, index) => (
                <li key={index}>
                  #{index + 1}: {a.text} @ ({(a.x * 100).toFixed(1)}%, {(a.y * 100).toFixed(1)}%) - {a.timestamp.toFixed(2)}s
                  <button onClick={() => setAnnotations(prev => prev.filter((_, i) => i !== index))}>Eliminar</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {activePanel === 'angles' && (
          <div>
            <h3>Ángulos ({calculatedAngles.length})</h3>
            <ul>
              {calculatedAngles.map((angle, index) => (
                <li key={index}>
                  {angle.name}: {angle.angle.toFixed(1)}°
                  {angle.isUserDefined && <button onClick={() => setCalculatedAngles(prev => prev.filter((_, i) => i !== index))}>Eliminar</button>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {activePanel === 'captures' && (
          <div className={styles.capturedFramesPanel}>
            <h3>Capturas ({capturedFrames.length})</h3>
            {capturedFrames.map(frame => (
              <div key={frame.id} className={styles.frameItem}>
                <img src={frame.imageData} alt={frame.name} className={styles.thumbnail} />
                <div>
                  <p>{frame.name} @ {frame.time.toFixed(2)}s</p>
                  <p>Notas: {frame.notes}</p>
                  <button onClick={() => {
                    if (videoRef.current) videoRef.current.currentTime = frame.time;
                  }}>Ir al Frame</button>
                  <button onClick={() => setCapturedFrames(prev => prev.filter(f => f.id !== frame.id))}>Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCaptureOverlay && (
        <div className={styles.captureOverlay}>
          <h3>Capturar Frame</h3>
          <input 
            type="text" 
            value={frameCaptureName} 
            onChange={(e) => setFrameCaptureName(e.target.value)} 
            placeholder="Nombre del frame" 
          />
          <textarea 
            value={frameAnalysisNotes} 
            onChange={(e) => setFrameAnalysisNotes(e.target.value)} 
            placeholder="Notas de análisis" 
          />
          <select value={captureQuality} onChange={(e) => setCaptureQuality(e.target.value)}>
            <option value="high">Alta Calidad</option>
            <option value="medium">Media</option>
            <option value="low">Baja</option>
          </select>
          <label>
            Incluir Esqueleto
            <input type="checkbox" checked={includeSkeletonInCapture} onChange={(e) => setIncludeSkeletonInCapture(e.target.checked)} />
          </label>
          <button onClick={captureFrame}>Confirmar Captura</button>
          <button onClick={() => setShowCaptureOverlay(false)}>Cancelar</button>
        </div>
      )}
    </div>
  );
}