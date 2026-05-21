// src/pages/RegistroGymDiario.jsx

import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useNavigate, useLocation } from 'react-router-dom';
import ConfirmModal from '../components/ConfirmModal';
import styles from '../styles/RegistroGymDiario.module.css';

// Iconos para UI Premium
import { 
  FaArrowLeft, FaSave, FaDumbbell, FaPlus, FaCalendarAlt, 
  FaBed, FaLayerGroup, FaWeightHanging, FaClock, FaRunning
} from 'react-icons/fa';

// Genera un ID único sencillo
const generateUniqueId = () => `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

export default function RegistroGymDiario() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // ¿Estamos editando un registro existente?
  const editId = new URLSearchParams(location.search).get('id');
  const isEditing = Boolean(editId);

  // Referencia Firestore para este usuario
  const docRef = useMemo(
    () => user?.email && doc(db, 'registroGymDiario', user.email),
    [user?.email]
  );

  // Estados del formulario
  const [recordId, setRecordId] = useState(editId || generateUniqueId());
  const [fecha, setFecha] = useState(new Date().toISOString().substr(0, 10));
  const [zona, setZona] = useState('');
  const [plan, setPlan] = useState('');
  const [unidadPeso, setUnidadPeso] = useState('kg');
  const [ejercicios, setEjercicios] = useState([
    { nombre: '', repeticiones: 1, descanso: 1, descansoSiguiente: 0, pesos: [''] }
  ]);
  const [sleepHours, setSleepHours] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Cargar datos si estamos editando
  useEffect(() => {
    if (!loading && isEditing && docRef) {
      (async () => {
        const snap = await getDoc(docRef);
        if (!snap.exists()) return;
        const regs = snap.data().registros || [];
        const one = regs.find(r => r.id === editId);
        if (!one) return;
        setRecordId(one.id);
        setFecha(one.fecha);
        setZona(one.zona);
        setPlan(one.plan);
        setUnidadPeso(one.unidadPeso);
        setEjercicios(one.ejercicios);
        setSleepHours(one.sleepHours?.toString() || '');
      })();
    }
  }, [loading, isEditing, editId, docRef]);

  // Si salimos de editar, resetea formulario
  useEffect(() => {
    if (!isEditing && !loading) {
      setRecordId(generateUniqueId());
      setFecha(new Date().toISOString().substr(0, 10));
      setZona('');
      setPlan('');
      setUnidadPeso('kg');
      setEjercicios([{ nombre: '', repeticiones: 1, descanso: 1, descansoSiguiente: 0, pesos: [''] }]);
      setSleepHours('');
    }
  }, [loading, isEditing]);

  const handleAddEjercicio = () =>
    setEjercicios(prev => [
      ...prev,
      { nombre: '', repeticiones: 1, descanso: 1, descansoSiguiente: 0, pesos: [''] }
    ]);

  const handleEjercicioChange = (i, field, v) =>
    setEjercicios(prev => {
      const upd = [...prev];
      const ej = { ...upd[i] };
      if (field === 'repeticiones') {
        const reps = Number(v);
        ej.repeticiones = reps;
        ej.pesos = Array(reps).fill('');
      } else if (field.startsWith('peso_')) {
        const idx = Number(field.split('_')[1]);
        ej.pesos = [...ej.pesos];
        ej.pesos[idx] = v;
      } else {
        ej[field] = field === 'nombre' ? v : Number(v);
      }
      upd[i] = ej;
      return upd;
    });

  const confirmGuardar = async () => {
    if (!docRef) return;
    // Validaciones mínimas
    if (!plan.trim()) return alert('La descripción del plan no puede estar vacía.');
    if (!zona) return alert('Selecciona un área principal.');
    const h = Number(sleepHours);
    if (isNaN(h) || h < 1 || h > 10) return alert('Ingresa horas de sueño válidas (1–10).');
    if (ejercicios.some(e => !e.nombre.trim())) return alert('Completa el nombre de todos los ejercicios.');

    // Nuevo objeto de registro
    const nuevoRegistro = { id: recordId, fecha, zona, plan, unidadPeso, ejercicios, sleepHours: h };

    // Lee los existentes
    const snap = await getDoc(docRef);
    const existing = snap.exists() ? snap.data().registros || [] : [];

    // Reconstruye array: si editando, reemplaza sólo ese id; si no, antepone pero sin duplicarlo
    let updated;
    if (isEditing) {
      updated = existing.map(r => (r.id === recordId ? nuevoRegistro : r));
    } else {
      // evita duplicados si por algún motivo ya existe ese id
      if (existing.some(r => r.id === recordId)) {
        updated = existing.map(r => (r.id === recordId ? nuevoRegistro : r));
      } else {
        updated = [nuevoRegistro, ...existing];
      }
    }

    // Un único setDoc con merge
    await setDoc(docRef, { registros: updated }, { merge: true });

    setShowSaveModal(false);
    navigate('/registro-gym');
  };

  if (loading) return <div className={styles.loading}>Cargando...</div>;

  return (
    <div className={styles.mainWrapper}>
      <div className={styles.container}>
        
        {/* HEADER */}
        <div className={styles.header}>
          <button className={styles.btnBack} onClick={() => navigate('/registro-gym')}>
            <FaArrowLeft />
          </button>
          <h2 className={styles.pageTitle}>{isEditing ? 'EDITAR SESIÓN' : 'NUEVA SESIÓN DIARIA'}</h2>
        </div>

        {/* TARJETA DE INFORMACIÓN GENERAL */}
        <div className={styles.glassCard}>
            <h3 className={styles.sectionTitle}><FaRunning /> Detalles de la Sesión</h3>
            
            <div className={styles.gridTwo}>
                <div className={styles.formGroup}>
                    <label>Fecha</label>
                    <div className={styles.inputIconWrapper}>
                        <FaCalendarAlt className={styles.icon} />
                        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} disabled={isEditing} className={styles.inputNeon} />
                    </div>
                </div>
                <div className={styles.formGroup}>
                    <label>Horas Sueño</label>
                    <div className={styles.inputIconWrapper}>
                        <FaBed className={styles.icon} />
                        <input type="number" min="1" max="10" placeholder="Ej: 7" value={sleepHours} onChange={e => setSleepHours(e.target.value)} className={styles.inputNeon} />
                    </div>
                </div>
            </div>

            <div className={styles.gridTwo}>
                <div className={styles.formGroup}>
                    <label>Zona</label>
                    <div className={styles.inputIconWrapper}>
                        <FaLayerGroup className={styles.icon} />
                        <select value={zona} onChange={e => setZona(e.target.value)} className={styles.selectNeon}>
                            <option value="">Seleccionar...</option>
                            <option value="Inferior">Tren Inferior</option>
                            <option value="Superior">Tren Superior</option>
                            <option value="Core">Core / Abdomen</option>
                            <option value="Full Body">Full Body</option>
                            <option value="Cardio">Cardio</option>
                        </select>
                    </div>
                </div>
                <div className={styles.formGroup}>
                    <label>Unidad</label>
                    <div className={styles.inputIconWrapper}>
                        <FaWeightHanging className={styles.icon} />
                        <select value={unidadPeso} onChange={e => setUnidadPeso(e.target.value)} className={styles.selectNeon}>
                            <option value="kg">Kilogramos (kg)</option>
                            <option value="lb">Libras (lb)</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className={styles.formGroup}>
                <label>Descripción / Plan del día</label>
                <textarea
                    className={styles.textareaNeon}
                    rows={3}
                    placeholder="Ej: Circuito de fuerza explosiva, 4 vueltas..."
                    value={plan}
                    onChange={e => setPlan(e.target.value)}
                />
            </div>
        </div>

        {/* LISTADO DE EJERCICIOS */}
        <div className={styles.exercisesSection}>
            <h3 className={styles.exercisesTitle}>
                <FaDumbbell /> Ejercicios ({ejercicios.length})
            </h3>
            
            {ejercicios.map((ej, idx) => (
                <div key={idx} className={styles.exerciseCard}>
                    <div className={styles.exerciseHeader}>
                        <span className={styles.exerciseIndex}>#{idx + 1}</span>
                        <input
                            type="text"
                            placeholder="Nombre del Ejercicio"
                            value={ej.nombre}
                            onChange={e => handleEjercicioChange(idx, 'nombre', e.target.value)}
                            className={styles.inputExerciseName}
                        />
                    </div>

                    <div className={styles.statsGrid}>
                        <div className={styles.statBox}>
                            <label>Series/Reps</label>
                            <input
                                type="number" min="1"
                                value={ej.repeticiones}
                                onChange={e => handleEjercicioChange(idx, 'repeticiones', e.target.value)}
                                className={styles.inputStat}
                            />
                        </div>
                        <div className={styles.statBox}>
                            <label>Desc (min)</label>
                            <div className={styles.iconInputSmall}>
                                <FaClock size={10} />
                                <input
                                    type="number" min="0"
                                    value={ej.descanso}
                                    onChange={e => handleEjercicioChange(idx, 'descanso', e.target.value)}
                                    className={styles.inputStat}
                                />
                            </div>
                        </div>
                        <div className={styles.statBox}>
                            <label>Next (min)</label>
                            <div className={styles.iconInputSmall}>
                                <FaArrowLeft size={10} style={{transform: 'rotate(180deg)'}} />
                                <input
                                    type="number" min="0"
                                    value={ej.descansoSiguiente}
                                    onChange={e => handleEjercicioChange(idx, 'descansoSiguiente', e.target.value)}
                                    className={styles.inputStat}
                                />
                            </div>
                        </div>
                    </div>

                    <div className={styles.weightsSection}>
                        <label className={styles.weightsLabel}>Cargas ({unidadPeso})</label>
                        <div className={styles.weightsGrid}>
                            {ej.pesos.map((p, pIdx) => (
                                <input
                                    key={pIdx}
                                    type="number" min="0"
                                    placeholder={`R${pIdx + 1}`}
                                    value={p}
                                    onChange={e => handleEjercicioChange(idx, `peso_${pIdx}`, e.target.value)}
                                    className={styles.inputWeight}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            ))}

            <button className={styles.btnAdd} onClick={handleAddEjercicio}>
                <FaPlus /> Añadir Ejercicio
            </button>
        </div>

        {/* BOTÓN GUARDAR FLOTANTE/FINAL */}
        <div className={styles.footerAction}>
            <button className={styles.btnSave} onClick={() => setShowSaveModal(true)}>
                <FaSave /> {isEditing ? 'ACTUALIZAR SESIÓN' : 'GUARDAR SESIÓN'}
            </button>
        </div>

        {/* MODAL CONFIRMACIÓN */}
        <ConfirmModal
            isOpen={showSaveModal}
            title={isEditing ? 'Confirmar Actualización' : 'Confirmar Guardado'}
            onConfirm={confirmGuardar}
            onCancel={() => setShowSaveModal(false)}
            confirmText={isEditing ? 'Actualizar' : 'Guardar'}
        >
            <p className={styles.modalText}>
            {isEditing
                ? '¿Deseas actualizar los datos de esta sesión?'
                : '¿Deseas guardar esta nueva sesión en tu historial?'}
            </p>
        </ConfirmModal>
      </div>
    </div>
  );
}