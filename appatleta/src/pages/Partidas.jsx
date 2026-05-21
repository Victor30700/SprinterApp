import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import audio1 from '../assets/audio1.mp3';
import audio2 from '../assets/audio2.mp3';
import audio3 from '../assets/audio3.mp3';
import '../styles/Partidas.css';
// Nuevos iconos para mejorar la UI
import { FaArrowLeft, FaStopwatch, FaVolumeUp, FaRunning, FaFlagCheckered } from 'react-icons/fa';
import { GiPistolGun } from 'react-icons/gi';

export default function Partidas() {
  const navigate = useNavigate();
  const [tiempo1, setTiempo1] = useState(2);
  const [tiempo2, setTiempo2] = useState(3);
  const [tiempo3, setTiempo3] = useState(1.5);
  const [estado, setEstado] = useState('Esperando');
  const [customPistola, setCustomPistola] = useState(null);
  const [secuenciaActiva, setSecuenciaActiva] = useState(false);

  const audioRef1 = useRef(null);
  const audioRef2 = useRef(null);
  const audioRef3 = useRef(null);
  const timeouts = useRef([]);

  // --- LOGICA ORIGINAL INTACTA ---
  const iniciarSecuencia = () => {
    if (secuenciaActiva) return;
    setSecuenciaActiva(true);
    setEstado('Preparando...');

    const timeout1 = setTimeout(() => {
      setEstado('A sus marcas...');
      reproducir(audioRef1);

      const timeout2 = setTimeout(() => {
        setEstado('Listo...');
        reproducir(audioRef2);

        const timeout3 = setTimeout(() => {
          setEstado('¡YA!');
          if (customPistola) {
            customPistola.currentTime = 0;
            customPistola.play();
          } else {
            reproducir(audioRef3);
          }

          const timeout4 = setTimeout(() => {
            setEstado('Secuencia finalizada');
            setSecuenciaActiva(false);
          }, 2000);

          timeouts.current.push(timeout4);
        }, tiempo3 * 1000);

        timeouts.current.push(timeout3);
      }, tiempo2 * 1000);

      timeouts.current.push(timeout2);
    }, tiempo1 * 1000);

    timeouts.current.push(timeout1);
  };

  const cancelarSecuencia = () => {
    timeouts.current.forEach(clearTimeout);
    timeouts.current = [];

    detener(audioRef1);
    detener(audioRef2);
    detener(audioRef3);
    if (customPistola) {
      customPistola.pause();
      customPistola.currentTime = 0;
    }

    setEstado('Esperando');
    setSecuenciaActiva(false);
  };

  const reproducir = (audioRef) => {
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    audioRef.current.play();
  };

  const detener = (audioRef) => {
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
  };

  const handleAudioUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const customAudio = new Audio(URL.createObjectURL(file));
      setCustomPistola(customAudio);
    }
  };

  // Helper para determinar la clase CSS según el estado (para efectos visuales)
  const getStatusClass = () => {
    switch (estado) {
      case 'A sus marcas...': return 'status-marks'; // Rojo/Preparado
      case 'Listo...': return 'status-set'; // Amarillo/Tensión
      case '¡YA!': return 'status-go'; // Verde/Flash
      case 'Secuencia finalizada': return 'status-finished';
      case 'Preparando...': return 'status-loading';
      default: return 'status-idle';
    }
  };

  return (
    <div className="partida-background">
      <div className={`partida-container ${getStatusClass()}`}>
        
        {/* Header simple */}
        <div className="partida-header">
          <button className="btn-icon-back" onClick={() => navigate('/')}>
            <FaArrowLeft />
          </button>
          <h2>Simulador de Salida</h2>
        </div>

        {/* VISUALIZADOR PRINCIPAL (SEMÁFORO) */}
        <div className="status-display-container">
          <div className={`status-light ${getStatusClass()}`}>
            <div className="light-icon">
              {estado === '¡YA!' ? <GiPistolGun /> : 
               estado === 'Listo...' ? <FaRunning /> : 
               estado === 'A sus marcas...' ? <FaFlagCheckered /> : 
               <FaStopwatch />}
            </div>
          </div>
          <h1 className="status-text">{estado}</h1>
        </div>

        {/* PANEL DE CONFIGURACIÓN (Solo visible si no está activa la secuencia o si quieres verlo siempre, lo deshabilitamos visualmente cuando corre) */}
        <div className={`config-panel ${secuenciaActiva ? 'disabled-panel' : ''}`}>
          
          <div className="inputs-row">
            <div className="input-group">
              <label>Marcas (s)</label>
              <input type="number" value={tiempo1} min="0" step="0.1" onChange={e => setTiempo1(parseFloat(e.target.value))} />
            </div>
            <div className="input-group">
              <label>Listos (s)</label>
              <input type="number" value={tiempo2} min="0" step="0.1" onChange={e => setTiempo2(parseFloat(e.target.value))} />
            </div>
            <div className="input-group">
              <label>Disparo (s)</label>
              <input type="number" value={tiempo3} min="0" step="0.1" onChange={e => setTiempo3(parseFloat(e.target.value))} />
            </div>
          </div>

          <div className="audio-upload-group">
            <label className="file-upload-label">
              <FaVolumeUp /> 
              <span>{customPistola ? "Sonido personalizado cargado" : "Cambiar sonido de pistola"}</span>
              <input type="file" accept="audio/*" onChange={handleAudioUpload} className="hidden-file-input" />
            </label>
          </div>
        </div>

        {/* BOTONES DE ACCIÓN */}
        <div className="action-buttons">
          {!secuenciaActiva ? (
            <button className="btn-main start" onClick={iniciarSecuencia}>
              INICIAR SALIDA
            </button>
          ) : (
            <button className="btn-main cancel" onClick={cancelarSecuencia}>
              DETENER / SALIDA FALSA
            </button>
          )}
        </div>

        {/* Audios Ocultos */}
        <audio ref={audioRef1} src={audio1} />
        <audio ref={audioRef2} src={audio2} />
        <audio ref={audioRef3} src={audio3} />
      </div>
    </div>
  );
}