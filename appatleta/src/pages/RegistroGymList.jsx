import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../config/firebase';
import { collection, getDocs, deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import styles from '../styles/RegistroGymList.module.css';

// Iconos para mejorar la UI
import { 
  FaArrowLeft, FaPlus, FaFilePdf, FaDumbbell, FaCalendarAlt, 
  FaEdit, FaTrash, FaWeightHanging, FaClipboardList, FaCheckCircle 
} from 'react-icons/fa';

export default function RegistroGymList() {
  const navigate = useNavigate();
  const auth = getAuth();
  const user = auth.currentUser;

  const [mode, setMode] = useState('mensual'); // 'mensual' o 'diario'
  const [busqueda, setBusqueda] = useState('');
  const [mensual, setMensual] = useState([]);
  const [diario, setDiario] = useState([]);

  // Cargar registros mensuales
  const cargarMensual = async () => {
    if (!user) return;
    const snap = await getDocs(collection(db, 'registrosGym'));
    const datos = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(r => (r.metadata?.email || r.email) === user.email);
    setMensual(datos);
  };

  // Cargar registros diarios con ID
  const cargarDiario = async () => {
    if (!user) return;
    const docRef = doc(db, 'registroGymDiario', user.email);
    const snap = await getDoc(docRef);
    const data = snap.exists() ? snap.data().registros || [] : [];
    setDiario(data.map(r => ({ id: r.id, ...r })));
  };

  useEffect(() => {
    cargarMensual();
    cargarDiario();
  }, [user]);

  // Filtrar por mes-año
  const filtrar = array => {
    if (!busqueda) return array;
    return array.filter(r => {
      const fechaStr = mode === 'mensual'
        ? (r.plan?.fechaInicio || '')
        : r.fecha;
      if (!fechaStr) return false;
      const dt = new Date(fechaStr);
      const mes = String(dt.getMonth() + 1).padStart(2, '0');
      const anio = dt.getFullYear();
      return `${anio}-${mes}`.includes(busqueda);
    });
  };

  // Eliminar mensual
  const handleEliminarMensual = async id => {
    if (!window.confirm('¿Seguro quieres eliminar este registro mensual?')) return;
    await deleteDoc(doc(db, 'registrosGym', id));
    setMensual(prev => prev.filter(r => r.id !== id));
  };

  // Eliminar diario
  const handleEliminarDiario = async id => {
    if (!window.confirm('¿Seguro quieres eliminar este registro diario?')) return;
    const docRef = doc(db, 'registroGymDiario', user.email);
    const snap = await getDoc(docRef);
    const existing = snap.exists() ? snap.data().registros || [] : [];
    const updated = existing.filter(r => r.id !== id);
    await setDoc(docRef, { registros: updated });
    setDiario(prev => prev.filter(r => r.id !== id));
  };

  // Listas filtradas y ordenadas
  const mensualFiltrada = useMemo(() => {
    return filtrar(mensual).sort((a, b) => new Date(b.plan?.fechaInicio || 0) - new Date(a.plan?.fechaInicio || 0));
  }, [mensual, busqueda]);

  const diarioFiltrado = useMemo(() => {
    return filtrar(diario).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  }, [diario, busqueda]);

  // Función para descargar PDF
  const downloadPDF = () => {
    const docPdf = new jsPDF({ unit: 'pt', format: 'letter' });
    if (mode === 'mensual') {
      docPdf.setFontSize(18);
      docPdf.text('SprinterApp - RegistroGym Mensual', 40, 40);

      // Columnas y filas
      const cols = [
        'Plan',
        'Fechas',
        'Peso Corporal',
        '% Carga Calculados',
        'Veces Cumplidas'
      ];
      const rows = mensualFiltrada.map(r => [
        r.plan?.descripcion || '–',
        `${r.plan?.fechaInicio || '–'} → ${r.plan?.fechaFin || '–'}`,
        r.pesocorporal ?? r.peso ?? '–',
        (r.calculos || []).map(c => `${c.porcentaje}%→${c.pesoCalculado}`).join('\n'),
        r.vecesQueCumplisteElPlan ?? r.repeticiones ?? 0
      ]);

      autoTable(docPdf, {
        startY: 70,
        head: [cols],
        body: rows,
        margin: { left: 40, right: 40 },
        styles: { fontSize: 10, cellPadding: 6 },
        headStyles: { fillColor: [33,47,61], textColor: 255 }
      });
    } else {
      docPdf.setFontSize(18);
      docPdf.text('SprinterApp - RegistroGym - Diario', 40, 40);

      const cols = ['Fecha','Zona','Plan','Unidad','Ejercicios'];
      const rows = diarioFiltrado.map(r => [
        r.fecha,
        r.zona,
        r.plan,
        r.unidadPeso,
        (r.ejercicios || []).map(e => `${e.nombre}(${e.repeticiones}r)`).join('\n')
      ]);

      autoTable(docPdf, {
        startY: 70,
        head: [cols],
        body: rows,
        margin: { left: 40, right: 40 },
        styles: { fontSize: 10, cellPadding: 6 },
        headStyles: { fillColor: [33,47,61], textColor: 255 }
      });
    }
    docPdf.save(`SprinterApp_${mode === 'mensual' ? 'Mensual' : 'Diario'}_${busqueda || 'todos'}.pdf`);
  };

  return (
    <div className={styles.listaWrapper}>
      <div className={styles.listaContainer}>
        
        {/* === HEADER SUPERIOR === */}
        <div className={styles.topBar}>
            <button className={styles.btnIcon} onClick={() => navigate('/home')}>
                <FaArrowLeft /> Volver
            </button>
            <h2 className={styles.pageTitle}>Registro GYM</h2>
        </div>

        {/* === CONTROLES DE MODO (Switch) === */}
        <div className={styles.controlsSection}>
            <div className={styles.modeSwitch}>
                <button
                className={`${styles.switchBtn} ${mode==='mensual' ? styles.active : ''}`}
                onClick={() => setMode('mensual')}
                >
                📅 Mensual
                </button>
                <button
                className={`${styles.switchBtn} ${mode==='diario' ? styles.active : ''}`}
                onClick={() => setMode('diario')}
                >
                🏋️ Diario
                </button>
            </div>

            {/* Buscador & PDF */}
            <div className={styles.filterRow}>
                <div className={styles.dateInputWrapper}>
                    <FaCalendarAlt className={styles.inputIcon}/>
                    <input
                        id="busqueda"
                        type="month"
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                        className={styles.dateInput}
                    />
                </div>
                
                {busqueda && (mensualFiltrada.length || diarioFiltrado.length) > 0 && (
                <button className={styles.btnPdf} onClick={downloadPDF} title="Descargar PDF">
                    <FaFilePdf />
                </button>
                )}
            </div>
        </div>

        {/* === BOTÓN PRINCIPAL DE ACCIÓN === */}
        <button 
            className={styles.btnNewFull} 
            onClick={() => navigate(mode === 'mensual' ? '/registro-gym/nuevo' : '/registro-gym/diario')}
        >
            <FaPlus /> {mode === 'mensual' ? 'Crear Plan Mensual' : 'Registrar Sesión Diaria'}
        </button>

        {/* === LISTADO DE TARJETAS === */}
        <div className={styles.cardsGrid}>
          {mode === 'mensual' ? (
            /* MODO MENSUAL */
            mensualFiltrada.length === 0 ? <p className={styles.emptyState}>No hay planes mensuales.</p> :
            mensualFiltrada.map(r => (
                <div key={r.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardTitle}>{r.plan?.descripcion || 'Sin título'}</span>
                    <span className={styles.badgePrimary}>{r.pesocorporal ?? r.peso ?? '?'} kg</span>
                  </div>
                  
                  <div className={styles.cardBody}>
                    <div className={styles.infoRow}>
                        <FaCalendarAlt className={styles.infoIcon}/> 
                        <span>{r.plan?.fechaInicio} ➔ {r.plan?.fechaFin}</span>
                    </div>
                    
                    <div className={styles.infoRow}>
                        <FaCheckCircle className={styles.infoIcon}/> 
                        <span>Cumplido: <strong>{r.vecesQueCumplisteElPlan ?? r.repeticiones ?? 0}</strong> veces</span>
                    </div>

                    <div className={styles.calculosGrid}>
                        {(r.calculos || []).slice(0, 4).map((c, i) => (
                            <span key={i} className={styles.tagCalc}>
                                {c.porcentaje}%: {c.pesoCalculado}
                            </span>
                        ))}
                        {(r.calculos || []).length > 4 && <span>...</span>}
                    </div>
                  </div>

                  <div className={styles.cardFooter}>
                    <button className={styles.btnAction} onClick={() => navigate(`/registro-gym/nuevo?id=${r.id}`)}>
                        <FaEdit /> Editar
                    </button>
                    <button className={`${styles.btnAction} ${styles.btnDelete}`} onClick={() => handleEliminarMensual(r.id)}>
                        <FaTrash />
                    </button>
                  </div>
                </div>
              ))
          ) : (
            /* MODO DIARIO */
            diarioFiltrado.length === 0 ? <p className={styles.emptyState}>No hay registros diarios.</p> :
            diarioFiltrado.map(r => (
                <div key={r.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <div className={styles.headerLeft}>
                        <span className={styles.cardDate}>{r.fecha}</span>
                        <span className={styles.cardZone}>{r.zona}</span>
                    </div>
                    <span className={styles.badgeSecondary}>{r.unidadPeso}</span>
                  </div>

                  <div className={styles.cardBody}>
                    <div className={styles.planDescription}>
                        <FaClipboardList className={styles.infoIcon}/>
                        <p>{r.plan}</p>
                    </div>
                    
                    <div className={styles.ejerciciosList}>
                        <strong><FaDumbbell className={styles.infoIcon}/> Ejercicios:</strong>
                        <ul>
                        {r.ejercicios.slice(0, 3).map((e, i) => (
                            <li key={i}>
                                {e.nombre} <span className={styles.repsBadge}>x{e.repeticiones}</span>
                            </li>
                        ))}
                        {r.ejercicios.length > 3 && <li>... y {r.ejercicios.length - 3} más</li>}
                        </ul>
                    </div>
                  </div>

                  <div className={styles.cardFooter}>
                    <button className={styles.btnAction} onClick={() => navigate(`/registro-gym/diario?id=${r.id}`)}>
                        <FaEdit /> Editar
                    </button>
                    <button className={`${styles.btnAction} ${styles.btnDelete}`} onClick={() => handleEliminarDiario(r.id)}>
                        <FaTrash />
                    </button>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
}