// src/pages/HealthProfilePage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { app } from '../config/firebase';
import { useNavigate, useLocation } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import '../styles/HealthProfilePage.css';

// Iconos para UI Premium
import { 
  FaArrowLeft, FaWeight, FaCrutch, FaFilePdf, FaPlus, 
  FaEdit, FaTrash, FaHeartbeat, FaSearch, FaCalendarAlt
} from 'react-icons/fa';

export default function HealthProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const db = getFirestore(app);
  const ref = useMemo(() => user && doc(db, 'healthProfiles', user.email), [user, db]);

  const [view, setView] = useState('peso');
  const [busqueda, setBusqueda] = useState('');
  const [bodyEntries, setBodyEntries] = useState([]);
  const [allInjuries, setAllInjuries] = useState([]);
  const [loading, setLoading] = useState(false);

  // 1️⃣ Cambia la vista ('peso' o 'lesiones')
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setView(params.get('view') === 'lesiones' ? 'lesiones' : 'peso');
  }, [location.search]);

  // 2️⃣ Carga inicial de datos
  const cargarDatos = useMemo(() => async () => {
    if (!ref) return;
    setLoading(true);
    try {
      const snap = await getDoc(ref);
      const data = snap.exists() ? snap.data() : {};

      const bodies = data.bodyEntries || [];
      bodies.sort((a, b) => b.date.localeCompare(a.date));
      setBodyEntries(bodies);

      const inj = data.injuries || [];
      inj.sort((a, b) => b.date.localeCompare(a.date));
      setAllInjuries(inj);
    } finally {
      setLoading(false);
    }
  }, [ref]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // 3️⃣ Filtrado por mes/año
  const entradasFiltradas = useMemo(() => {
    const list = view === 'peso' ? bodyEntries : allInjuries;
    if (!busqueda) return list;
    return list.filter(e => e.date.startsWith(busqueda));
  }, [view, busqueda, bodyEntries, allInjuries]);

  // 4️⃣ Eliminar registro
  const handleDelete = async (type, idx) => {
    if (!window.confirm('¿Seguro que deseas eliminar este registro?')) return;
    setLoading(true);
    const key = type === 'peso' ? 'bodyEntries' : 'injuries';
    const updated = [...(type === 'peso' ? bodyEntries : allInjuries)];
    updated.splice(idx, 1);
    await setDoc(ref, { [key]: updated }, { merge: true });
    type === 'peso' ? setBodyEntries(updated) : setAllInjuries(updated);
    setLoading(false);
  };

  // 5️⃣ Generar y descargar PDF
  const downloadPDF = () => {
    const doc = new jsPDF('p', 'pt', 'letter');
    const title = view === 'peso'
      ? 'Registro Corporal - SprinterApp'
      : 'Historial de Lesiones - SprinterApp';

    doc.setFontSize(18);
    doc.text(title, 40, 40);

    let columns, rows;
    if (view === 'peso') {
      columns = [
        { header: 'Fecha', dataKey: 'date' },
        { header: 'Peso (kg)', dataKey: 'weightKg' },
        { header: 'Altura (m)', dataKey: 'heightM' },
        { header: '% Grasa', dataKey: 'bodyFat' },
        { header: 'Actividad', dataKey: 'activityLevel' },
        { header: 'Notas', dataKey: 'notes' },
        { header: 'IMC', dataKey: 'bmi' },
      ];
      rows = entradasFiltradas.map(e => ({
        date: e.date,
        weightKg: `${e.weightKg} (${e.weightLbs} lbs)`,
        heightM: `${e.heightM} (${e.heightFt})`,
        bodyFat: e.bodyFat ?? '—',
        activityLevel: e.activityLevel ?? '—',
        notes: e.notes ?? '—',
        bmi: `${e.bmi} (${e.category})`
      }));
    } else {
      columns = [
        { header: 'Fecha', dataKey: 'date' },
        { header: 'Lesión', dataKey: 'name' },
        { header: 'Estado', dataKey: 'active' },
        { header: 'Notas', dataKey: 'notes' }
      ];
      rows = entradasFiltradas.map(e => ({
        date: e.date,
        name: e.name,
        active: e.active ? 'Activa' : 'Recuperada',
        notes: e.notes ?? '—'
      }));
    }

    autoTable(doc, {
      startY: 60,
      head: [columns.map(col => col.header)],
      body: rows.map(row => columns.map(col => row[col.dataKey])),
      styles: { fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: [44, 62, 80], textColor: 255, halign: 'center' },
      margin: { left: 40, right: 40 },
      tableWidth: 'auto',
    });

    doc.save(`${title.replace(/\s+/g,'_')}-${busqueda || 'todos'}.pdf`);
  };

  return (
    <div className="health-profile-wrapper">
      <div className="health-profile-container">
        
        {/* HEADER */}
        <div className="health-header">
          <button className="btn-icon-back" onClick={() => navigate('/home')}>
            <FaArrowLeft />
          </button>
          <h2 className="health-title">PERFIL DE SALUD</h2>
        </div>

        {/* CONTROLES SUPERIORES (SWITCH Y FILTROS) */}
        <div className="controls-card">
            <div className="view-switch-neon">
                <button
                    className={`switch-btn ${view === 'peso' ? 'active' : ''}`}
                    onClick={() => navigate('/health-profile?view=peso')}
                    disabled={loading}
                >
                    <FaWeight /> Corporal
                </button>
                <button
                    className={`switch-btn ${view === 'lesiones' ? 'active' : ''}`}
                    onClick={() => navigate('/health-profile?view=lesiones')}
                    disabled={loading}
                >
                    <FaCrutch /> Lesiones
                </button>
            </div>

            <div className="search-bar-neon">
                <div className="input-wrapper">
                    <FaCalendarAlt className="search-icon"/>
                    <input
                        type="month"
                        className="search-input"
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                        disabled={loading}
                    />
                </div>
                
                {busqueda && entradasFiltradas.length > 0 && (
                    <button className="btn-pdf-icon" onClick={downloadPDF} disabled={loading} title="Descargar PDF">
                        <FaFilePdf />
                    </button>
                )}
            </div>
        </div>

        {/* CONTENIDO PRINCIPAL */}
        <div className="main-content">
            
            <button
                className="btn-add-neon"
                onClick={() =>
                    navigate(
                        view === 'peso'
                        ? '/health-profile/peso-altura'
                        : '/health-profile/lesiones'
                    )
                }
                disabled={loading}
            >
                <FaPlus /> {view === 'peso' ? 'Registrar Medición' : 'Reportar Lesión'}
            </button>

            {loading && <div className="loading-spinner">Cargando...</div>}

            <div className="entries-grid">
                {entradasFiltradas.length === 0 && !loading ? (
                    <div className="empty-state">
                        <FaHeartbeat size={40} />
                        <p>No hay registros disponibles.</p>
                    </div>
                ) : (
                    entradasFiltradas.map((e, i) => (
                        <div
                            key={i}
                            className={`entry-card ${
                                view === 'lesiones' && e.active === false ? 'recovered-card' : ''
                            }`}
                        >
                            {view === 'peso' ? (
                                /* TARJETA DE PESO */
                                <>
                                    <div className="card-header">
                                        <div className="date-badge">{e.date}</div>
                                        <div className="bmi-badge">IMC: {e.bmi}</div>
                                    </div>
                                    
                                    <div className="card-body-grid">
                                        <div className="stat-box">
                                            <span className="label">Peso</span>
                                            <span className="value">{e.weightKg} <small>kg</small></span>
                                        </div>
                                        <div className="stat-box">
                                            <span className="label">Grasa</span>
                                            <span className="value">{e.bodyFat || '--'}</span>
                                        </div>
                                        <div className="stat-box">
                                            <span className="label">Altura</span>
                                            <span className="value">{e.heightM} <small>m</small></span>
                                        </div>
                                    </div>

                                    {e.notes && (
                                        <div className="notes-box">
                                            <span>📝 Notas:</span> {e.notes}
                                        </div>
                                    )}
                                </>
                            ) : (
                                /* TARJETA DE LESIÓN */
                                <>
                                    <div className="card-header">
                                        <div className="date-badge">{e.date}</div>
                                        <span className={`status-badge ${e.active ? 'active' : 'recovered'}`}>
                                            {e.active ? '⚠️ Activa' : '✅ Recuperada'}
                                        </span>
                                    </div>
                                    
                                    <h3 className="injury-title">{e.name}</h3>
                                    
                                    {e.notes && (
                                        <div className="notes-box injury-notes">
                                            {e.notes}
                                        </div>
                                    )}
                                </>
                            )}

                            <div className="card-actions">
                                <button
                                    className="action-btn edit"
                                    onClick={() =>
                                        navigate(
                                            `/health-profile/${
                                                view === 'peso' ? 'peso-altura' : 'lesiones'
                                            }?edit=${i}`
                                        )
                                    }
                                    disabled={loading}
                                >
                                    <FaEdit /> Editar
                                </button>
                                <button 
                                    className="action-btn delete" 
                                    onClick={() => handleDelete(view, i)} 
                                    disabled={loading}
                                >
                                    <FaTrash />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
      </div>
    </div>
  );
}