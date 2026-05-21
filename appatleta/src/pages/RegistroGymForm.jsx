// src/pages/RegistroGymForm.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../config/firebase';
import { getAuth } from 'firebase/auth';
import {
  collection,
  addDoc,
  doc,
  getDoc,
  updateDoc
} from 'firebase/firestore';
import '../styles/RegistroGymForm.css';

// Iconos
import { 
  FaArrowLeft, FaSave, FaCalculator, FaPlus, FaTimes, FaDumbbell, 
  FaCalendarAlt, FaClipboardList, FaCheckCircle, FaMinus, FaMagic 
} from 'react-icons/fa';

export default function RegistroGymForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const registroId = searchParams.get('id');
  const auth = getAuth();
  const user = auth.currentUser;

  // Estados del Formulario
  const [pesocorporal, setPesocorporal] = useState(''); // String vacío al inicio para placeholder
  const [percentInput, setPercentInput] = useState('');
  const [porcentajesCarga, setPorcentajesCarga] = useState([]);
  const [calculos, setCalculos] = useState([]);
  
  const [historialReps, setHistorialReps] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [modalEstado, setModalEstado] = useState(5);
  const [modalAnimo, setModalAnimo] = useState('neutral');
  
  const [plan, setPlan] = useState({ fechaInicio: '', fechaFin: '', descripcion: '' });

  // Cargar Datos
  useEffect(() => {
    async function cargarRegistro() {
      if (!registroId || !user) return;
      const docRef = doc(db, 'registrosGym', registroId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return;
      
      const data = docSnap.data();
      const recordEmail = data.metadata?.email || data.email;
      
      if (recordEmail !== user.email) {
        alert('No tienes permiso para editar este registro.');
        return navigate('/registro-gym');
      }

      setPesocorporal(data.peso || '');
      setPorcentajesCarga(data.porcentajesCarga ?? data.porcentajes ?? []);
      setCalculos(data.calculos ?? data.calculados ?? []);
      setHistorialReps(data.historialReps ?? data.repHistory ?? []);
      setPlan(
        data.plan
          ? data.plan
          : {
              fechaInicio: data.fechaInicio || '',
              fechaFin: data.fechaFin || '',
              descripcion: data.descripcion || ''
            }
      );
    }
    cargarRegistro();
  }, [registroId, user, navigate]);

  // --- LÓGICA CALCULADORA MEJORADA ---
  const addPercentage = (valOverride) => {
    // Si pasamos un valor directo (botones rápidos), úsalo. Si no, usa el input.
    const rawVal = valOverride !== undefined ? valOverride : percentInput;
    const val = parseFloat(rawVal);

    if (isNaN(val) || val <= 0) return;
    
    // Evitar duplicados visuales si se desea
    if (!porcentajesCarga.includes(val)) {
        setPorcentajesCarga((p) => [...p, val].sort((a, b) => a - b));
    }
    setPercentInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Evita submit del form
      addPercentage();
    }
  };

  const removePercentage = (valToRemove) => {
    setPorcentajesCarga((p) => p.filter((val) => val !== valToRemove));
  };

  const calcularPesos = (e) => {
    if(e) e.preventDefault();
    if (!pesocorporal || pesocorporal <= 0) {
        alert("Ingresa tu peso corporal primero.");
        return;
    }
    const results = porcentajesCarga.map((p) => ({
      porcentaje: p,
      pesoCalculado: +(pesocorporal * p / 100).toFixed(2)
    }));
    setCalculos(results);
  };

  // --- LÓGICA SESIONES ---
  const handleIncrement = (e) => { e.preventDefault(); setShowModal(true); };
  const handleDecrement = (e) => {
    e.preventDefault();
    if (!historialReps.length) return;
    if (window.confirm('¿Eliminar la última sesión registrada?')) {
      setHistorialReps((h) => h.slice(0, -1));
    }
  };

  const saveModal = () => {
    const now = new Date().toISOString();
    setHistorialReps((h) => [...h, { fecha: now, estadoFisico: modalEstado, animo: modalAnimo }]);
    setShowModal(false);
  };
  const cancelModal = () => setShowModal(false);

  // --- GUARDAR ---
  const handleGuardar = async () => {
    if (!plan.descripcion.trim()) return alert("Añade una descripción al plan");

    const registro = {
      peso: Number(pesocorporal),
      porcentajesCarga,
      calculos,
      historialReps,
      repeticiones: historialReps.length, // Compatibilidad hacia atrás
      plan,
      metadata: {
        email: user.email,
        actualizadoEn: new Date().toISOString(),
        ...(registroId ? {} : { creadoEn: new Date().toISOString() })
      }
    };

    try {
      if (registroId) {
        await updateDoc(doc(db, 'registrosGym', registroId), registro);
      } else {
        await addDoc(collection(db, 'registrosGym'), registro);
      }
      navigate('/registro-gym');
    } catch (error) {
      console.error('Error al guardar:', error);
      alert("Error al guardar en la base de datos");
    }
  };

  return (
    <div className="gym-form-wrapper">
      <div className="gym-form-container">
        
        {/* HEADER CORREGIDO */}
        <div className="form-header-fixed">
            <button className="btn-icon-back" onClick={() => navigate(-1)}>
                <FaArrowLeft />
            </button>
            <h2 className="form-title-text">{registroId ? 'EDITAR PLAN' : 'NUEVO PLAN MENSUAL'}</h2>
        </div>

        {/* 1. DETALLES DEL PLAN */}
        <div className="form-section card-glass">
            <h3 className="section-title"><FaClipboardList /> Definición del Plan</h3>
            
            <div className="form-group full-width">
                <label>Nombre / Objetivo del Mesociclo</label>
                <textarea 
                    className="input-neon textarea-neon"
                    placeholder="Ej: Hipertrofia Fase 1, Fuerza Máxima..."
                    value={plan.descripcion} 
                    onChange={(e) => setPlan({ ...plan, descripcion: e.target.value })} 
                />
            </div>

            <div className="row-2-col">
                <div className="form-group">
                    <label>Inicio</label>
                    <div className="input-with-icon">
                        <FaCalendarAlt className="icon-input"/>
                        <input type="date" className="input-neon" value={plan.fechaInicio} onChange={(e) => setPlan({ ...plan, fechaInicio: e.target.value })} />
                    </div>
                </div>
                <div className="form-group">
                    <label>Fin</label>
                    <div className="input-with-icon">
                        <FaCalendarAlt className="icon-input"/>
                        <input type="date" className="input-neon" value={plan.fechaFin} onChange={(e) => setPlan({ ...plan, fechaFin: e.target.value })} />
                    </div>
                </div>
            </div>
        </div>

        {/* 2. CALCULADORA DE CARGAS (REDISEÑADA E INTUITIVA) */}
        <div className="form-section card-glass">
            <div className="section-header-row">
                <h3 className="section-title"><FaDumbbell /> Calculadora de Cargas</h3>
                {calculos.length > 0 && <span className="badge-calc">Activa</span>}
            </div>
            
            <div className="form-group">
                <label>Peso Corporal (kg)</label>
                <input 
                    type="number" 
                    placeholder="Ej: 75.5"
                    className="input-neon input-large"
                    value={pesocorporal} 
                    onChange={(e) => setPesocorporal(e.target.value)} 
                />
            </div>

            <div className="form-group">
                <label>Añadir Porcentajes (%)</label>
                
                {/* Botones Rápidos (Presets) */}
                <div className="presets-row">
                    {[50, 60, 70, 80, 90, 100].map(val => (
                        <button key={val} className="btn-preset" onClick={() => addPercentage(val)}>
                            {val}%
                        </button>
                    ))}
                </div>

                {/* Input Manual */}
                <div className="inline-add-group">
                    <input 
                        type="number" 
                        placeholder="Otro % (Escribe y Enter)" 
                        className="input-neon"
                        value={percentInput} 
                        onChange={(e) => setPercentInput(e.target.value)}
                        onKeyDown={handleKeyDown} 
                    />
                    <button className="btn-icon-add" onClick={() => addPercentage()}><FaPlus /></button>
                </div>
                
                {/* Chips de porcentajes añadidos */}
                {porcentajesCarga.length > 0 && (
                    <div className="chips-container">
                        {porcentajesCarga.map((p, i) => (
                            <div key={`${p}-${i}`} className="chip">
                                <span>{p}%</span>
                                <button className="chip-close" onClick={() => removePercentage(p)}><FaTimes /></button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <button className="btn-secondary-neon pulse-effect" onClick={calcularPesos}>
                <FaMagic /> Generar Tabla de Pesos
            </button>

            {/* Resultados Visuales */}
            {calculos.length > 0 && (
                <div className="results-container">
                    <h4 className="results-title">Tus Cargas Sugeridas:</h4>
                    <div className="results-grid">
                        {calculos.map((r, i) => (
                            <div key={i} className="result-card">
                                <div className="res-top">{r.porcentaje}%</div>
                                <div className="res-mid">➔</div>
                                <div className="res-bottom">{r.pesoCalculado} <span>kg</span></div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>

        {/* 3. CONTROL DE SESIONES */}
        <div className="form-section card-glass">
            <h3 className="section-title"><FaCheckCircle /> Progreso de Sesiones</h3>
            <p className="helper-text">Registra cada vez que cumplas con tu rutina de gimnasio.</p>
            
            <div className="counter-wrapper">
                <button className="btn-counter minus" onClick={handleDecrement}><FaMinus /></button>
                <div className="counter-display">
                    <span className="counter-value">{historialReps.length}</span>
                    <span className="counter-label">Sesiones</span>
                </div>
                <button className="btn-counter plus" onClick={handleIncrement}><FaPlus /></button>
            </div>
        </div>

        {/* BOTÓN GUARDAR FLOTANTE/FINAL */}
        <button className="btn-save-primary" onClick={handleGuardar}>
            <FaSave /> {registroId ? 'ACTUALIZAR PLAN' : 'GUARDAR PLAN'}
        </button>

        {/* MODAL DE CONFIRMACIÓN */}
        {showModal && (
            <div className="modal-backdrop">
                <div className="modal-glass">
                    <h3 className="modal-title">¡Sesión Cumplida!</h3>
                    <p className="modal-subtitle">¿Cómo te sentiste hoy?</p>
                    
                    <div className="form-group">
                        <label>Estado Físico (1-10)</label>
                        <div className="range-container">
                            <span className="range-min">1</span>
                            <input 
                                type="range" 
                                min="1" 
                                max="10" 
                                value={modalEstado} 
                                onChange={(e) => setModalEstado(Number(e.target.value))} 
                                className="range-neon"
                            />
                            <span className="range-val-bubble">{modalEstado}</span>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Estado de Ánimo</label>
                        <select 
                            className="input-neon select-neon"
                            value={modalAnimo} 
                            onChange={(e) => setModalAnimo(e.target.value)}
                        >
                            <option value="enojado">😠 Enojado</option>
                            <option value="triste">😢 Triste</option>
                            <option value="neutral">😐 Neutral</option>
                            <option value="feliz">😊 Feliz</option>
                            <option value="super motivado">🚀 Motivado</option>
                        </select>
                    </div>

                    <div className="modal-footer">
                        <button className="btn-modal-cancel" onClick={cancelModal}>Cancelar</button>
                        <button className="btn-modal-confirm" onClick={saveModal}>Confirmar</button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}