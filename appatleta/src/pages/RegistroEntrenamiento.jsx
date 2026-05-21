// src/pages/RegistroEntrenamiento.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import ConfirmModal from '../components/ConfirmModal';
import StatusModal from '../components/StatusModal';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { 
  FaCalendarAlt, FaRunning, FaStopwatch, FaHeartbeat, FaBrain, FaBed, 
  FaEdit, FaTrash, FaCopy, FaFilePdf, FaPlus, 
  FaWind, FaThermometerHalf, FaShoePrints, FaChartLine, FaTimes, FaTrophy, FaArrowLeft
} from 'react-icons/fa';
import '../styles/RegistroEntrenamiento.css';

// --- COMPONENTE MODAL DE GRÁFICA ---
const ChartModal = ({ isOpen, onClose, record }) => {
  if (!isOpen || !record) return null;

  const datosGraficas = (() => {
    const grupos = {};
    if (record.promedios) {
        record.promedios.forEach((p, index) => {
            if (!p.pruebaKey) return;
            if (!grupos[p.pruebaKey]) grupos[p.pruebaKey] = [];
            grupos[p.pruebaKey].push({ ...p, originalIndex: index + 1 });
        });
    }
    return grupos;
  })();

  const renderGrafica = (distancia, bloques) => {
    let data = [];
    let colorLine = "#00ffe7"; 
    
    if (bloques.length > 1) {
      data = bloques.map((b, i) => ({ name: `B${i + 1}`, tiempo: parseFloat(b.promedio) || 0 }));
    } else if (bloques.length === 1) {
      const bloque = bloques[0];
      data = bloque.series.map((t, i) => ({ name: `R${i + 1}`, tiempo: parseFloat(t) || 0 }));
      colorLine = "#007aff";
    }
    data = data.filter(d => d.tiempo > 0);

    if(data.length < 2) return <div key={distancia} className="no-chart-msg">Datos insuficientes para gráfica de {distancia}</div>;

    const tiempos = data.map(d => d.tiempo);
    const minTime = Math.min(...tiempos);

    return (
      <div key={distancia} className="modal-chart-section">
        <h4 className="chart-title"><FaRunning/> {distancia}</h4>
        <div style={{ width: '100%', height: 220 }}>
          <ResponsiveContainer>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${distancia}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={colorLine} stopOpacity={0.4}/>
                  <stop offset="95%" stopColor={colorLine} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
              <YAxis reversed={true} stroke="#94a3b8" fontSize={10} domain={['dataMin - 0.2', 'dataMax + 0.2']} width={35} tickLine={false}/>
              <Tooltip contentStyle={{backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius:'8px', color: '#fff'}} />
              <ReferenceLine y={minTime} stroke="#ffd700" strokeDasharray="3 3" label={{ value: 'PB', fill: '#ffd700', fontSize: 10 }} />
              <Area type="monotone" dataKey="tiempo" stroke={colorLine} fill={`url(#grad-${distancia})`} strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content-chart">
        <button className="btn-close-modal" onClick={onClose}><FaTimes /></button>
        <h3>📊 Análisis de Rendimiento</h3>
        <p className="modal-date-subtitle">{record.fecha}</p>
        <div className="modal-charts-scroll">
           {Object.keys(datosGraficas).length > 0 
             ? Object.entries(datosGraficas).map(([dist, blqs]) => renderGrafica(dist, blqs))
             : <p className="empty-msg">No hay suficientes datos.</p>
           }
        </div>
      </div>
    </div>
  );
};

export default function RegistroEntrenamiento() {
  const { user, loading } = useAuth();
  const [registros, setRegistros] = useState([]);
  const [loadingRegs, setLoadingRegs] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteIdx, setDeleteIdx] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  
  const [selectedRecord, setSelectedRecord] = useState(null);

  const navigate = useNavigate();
  const docRegistro = user?.email && doc(db, 'registroEntreno', user.email);

  useEffect(() => {
    if (!loading && user) loadRegistros();
  }, [user, loading]);

  const loadRegistros = async () => {
    const snap = await getDoc(docRegistro);
    const data = snap.exists() ? snap.data().registros || [] : [];
    data.sort((a, b) => b.fecha.localeCompare(a.fecha));
    setRegistros(data);
    setLoadingRegs(false);
  };

  const filteredRegistros = useMemo(
    () => registros.filter(r => {
      if (!searchQuery) return true;
      const [y, m] = searchQuery.split('-');
      const [ry, rm] = r.fecha.split('-');
      return ry === y && rm === m;
    }),
    [registros, searchQuery]
  );

  const handleDelete = idx => {
    setDeleteIdx(idx);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    setStatusMessage('Eliminando...');
    setShowStatusModal(true);
    try {
      const next = registros.filter((_, i) => i !== deleteIdx);
      await setDoc(docRegistro, { registros: next });
      setRegistros(next);
    } catch (error) {
      console.error(error);
      alert('Error al eliminar');
    } finally {
      setShowStatusModal(false);
      setShowDeleteModal(false);
    }
  };

  // --- FUNCIÓN DE COPIADO ---
  const handleCopy = idx => {
    const r = filteredRegistros[idx];
    
    const vientoStr = r.clima?.wind ? `${r.clima.wind > 0 ? '+' : ''}${r.clima.wind}m/s` : '--';
    const tempStr = r.clima?.temp ? `${r.clima.temp}°C` : '--';
    const calzadoStr = r.calzado ? r.calzado.toUpperCase() : '--';

    let text = `⚡ *BITÁCORA SPRINTER* | ${r.fecha}\n`;
    text += `🌍 *Condiciones:* 🌬️ ${vientoStr} | 🌡️ ${tempStr} | 👟 ${calzadoStr}\n\n`;
    text += `📝 *PLAN:* ${r.plan || 'Sin descripción'}\n\n`;
    
    text += `🔹 *Series Registradas y Objetivos % :*\n`;
    if (r.series?.length) {
        const seriesByDist = {};
        r.series.forEach(s => {
            const key = s.distancia || s.pruebaKey;
            if(!seriesByDist[key]) seriesByDist[key] = [];
            seriesByDist[key].push(s);
        });

        Object.entries(seriesByDist).forEach(([dist, items]) => {
            const pbRef = items[0].base || 'N/D';
            text += `\n*(PB Ref: ${pbRef}s)*\n`;
            items.forEach(s => {
                text += `• ${dist}: ${s.porcentaje}% (Meta ${s.sugerido}s)\n`;
            });
        });
    } else {
        text += " (Sin series planificadas)\n";
    }
    text += '\n';

    text += `🚀 *Tiempos & ANÁLISIS*\n`;
    if (r.promedios?.length) {
        const grupos = {};
        r.promedios.forEach(p => {
            if(!p.pruebaKey) return;
            if(!grupos[p.pruebaKey]) grupos[p.pruebaKey] = [];
            grupos[p.pruebaKey].push(p);
        });

        Object.entries(grupos).forEach(([distancia, bloques]) => {
            text += `\n🏁 *${distancia}* \n`;
            text += `   *Tiempos:*\n`;

            let allTimes = []; 
            let distNumber = parseInt(distancia) || 0;
            let volumen = 0;

            bloques.forEach((b, k) => {
                const label = bloques.length > 1 ? `B${k+1}` : `R${k+1}`; 
                const tiemposStr = b.series.filter(t => t).join(', ');
                text += `  📍 ${label}: [${tiemposStr}] prom= *${b.promedio}s* \n`;
                
                const repsCount = b.series.filter(s=>s).length;
                volumen += repsCount * distNumber;

                b.series.forEach(t => {
                    const val = parseFloat(t);
                    if(!isNaN(val)) {
                        allTimes.push({ val, label: `${label}:${t}` });
                    }
                });
            });

            if (allTimes.length > 0) {
                const values = allTimes.map(x => x.val);
                const minVal = Math.min(...values);
                const maxVal = Math.max(...values);
                
                const best = allTimes.find(x => x.val === minVal).label;
                const worst = allTimes.find(x => x.val === maxVal).label;
                const fatiga = ((maxVal - minVal) / minVal * 100).toFixed(1);
                let labelFatiga = "Estable";
                if(fatiga > 10) labelFatiga = "Alta";
                else if(fatiga > 5) labelFatiga = "Moderada";
                else if(fatiga < 2) labelFatiga = "Baja";

                text += `   *ANÁLISIS:*\n`;
                text += `       *Mejor*: ${best} *Peor*: ${worst}\n`;
                text += `   💡 *Fatiga:* ${fatiga}% (${labelFatiga}) | *Vol:* ${volumen}m\n`;
            }
        });
    } else {
        text += " (Sin tiempos registrados)\n";
    }

    text += `\n📊 *ESTADO FISICO:* \n`;
    text += `💪 Físico: ${r.estadoFisico}/10 \n`;
    text += `🧠 Ánimo: ${r.animo}/5 \n`;
    text += `😴 Sueño: ${r.sleepHours ?? '-'}h`;

    navigator.clipboard.writeText(text)
      .then(() => alert('✅ Bitácora copiada al portapapeles'))
      .catch(() => alert('❌ Error al copiar'));
  };

  const handleEdit = (r, idx) => {
    setStatusMessage('Cargando datos...');
    setShowStatusModal(true);
    setTimeout(() => {
      setShowStatusModal(false);
      navigate('/registro/nuevo', { state: { editRecord: { ...r, index: idx } }});
    }, 500);
  };

  const generarPDF = () => {
    setStatusMessage('Generando PDF...');
    setShowStatusModal(true);
    setTimeout(() => {
      const doc = new jsPDF({ unit: 'pt', format: 'letter' });
      doc.setFontSize(18);
      doc.text('SprinterApp - Historial', 40, 40);
      const rows = filteredRegistros.map(r => ({
        fecha: r.fecha,
        plan: r.plan || '-',
        series: r.promedios ? r.promedios.map(p => `${p.pruebaKey}: Avg ${p.promedio}`).join('\n') : '-'
      }));
      autoTable(doc, {
        startY: 60,
        head: [['Fecha', 'Plan', 'Resumen Tiempos']],
        body: rows.map(r => [r.fecha, r.plan, r.series]),
      });
      doc.save('Entrenamientos.pdf');
      setShowStatusModal(false);
    }, 500);
  };

  if (loading || loadingRegs) return <div className="loading-container"><div className="spinner"></div><p>Cargando...</p></div>;
  if (!user) return <div className="access-denied">Acceso denegado</div>;

  return (
    <div className="registro-container">
      {/* BOTÓN DE NAVEGACIÓN SUPERIOR (AMPLIADO) */}
      <button className="btn-nav-full" onClick={() => navigate('/home')}>
           <FaArrowLeft /> Volver al Inicio
      </button>

      <div className="registro-header-wrapper">
        <h2 className="page-title">Historial Deportivo</h2>
        <div className="header-actions">
             <button onClick={() => navigate('/registro/nuevo')} className="btn-action btn-new">
                <FaPlus /> Nuevo
             </button>
        </div>
      </div>

      <div className="filters-bar">
        <div className="date-filter">
            <FaCalendarAlt className="filter-icon" />
            <input 
                type="month" 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
                className="custom-date-input"
            />
        </div>
        {searchQuery && filteredRegistros.length > 0 && (
            <button className="btn-action btn-pdf" onClick={generarPDF}><FaFilePdf /> PDF</button>
        )}
      </div>

      <div className="cards-grid">
        {filteredRegistros.length === 0 ? (
            <div className="empty-state">No hay registros para mostrar.</div>
        ) : (
            filteredRegistros.map((r, idx) => (
                <div key={idx} className="entreno-card">
                    {/* Header: Fecha y Contexto */}
                    <div className="card-header">
                        <div className="date-badge">
                            <span className="date-day">{r.fecha.split('-')[2]}</span>
                            <span className="date-month-year">{r.fecha.split('-')[1]}/{r.fecha.split('-')[0]}</span>
                        </div>
                        
                        <div className="context-badges-small">
                             {r.clima?.wind && <span className="c-badge wind"><FaWind/> {r.clima.wind}</span>}
                             {r.calzado && <span className="c-badge shoes"><FaShoePrints/> {r.calzado === 'clavos' ? 'Spikes' : 'Zapas'}</span>}
                        </div>

                        <div className="card-actions">
                            <button onClick={() => handleCopy(idx)} title="Copiar Bitácora"><FaCopy /></button>
                            <button onClick={() => handleEdit(r, idx)} title="Editar"><FaEdit /></button>
                            <button onClick={() => handleDelete(idx)} title="Eliminar" className="delete-btn"><FaTrash /></button>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="card-body">
                        {/* Plan */}
                        <div className="info-block plan-block">
                            <h4><FaRunning /> Plan del Día</h4>
                            <p className="plan-text">{r.plan || 'Sin descripción'}</p>
                        </div>

                        {/* Series & Tiempos Combinados */}
                        <div className="info-block">
                            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px'}}>
                                <h4><FaStopwatch /> Tiempos & PB</h4>
                                <button className="btn-view-graph-mini" onClick={() => setSelectedRecord(r)} title="Ver Gráfica">
                                    <FaChartLine />
                                </button>
                            </div>
                            
                            {r.promedios?.length ? (
                                <div className="detailed-times-list">
                                    {r.promedios.map((p, i) => {
                                        // Buscar PB
                                        const serieData = r.series?.find(s => s.pruebaKey === p.pruebaKey);
                                        const pbVal = serieData?.base;

                                        return (
                                            <div key={i} className="time-block-row">
                                                <div className="row-top">
                                                    <span className="dist-title">{p.pruebaKey}</span>
                                                    {pbVal && <span className="pb-badge"><FaTrophy size={10}/> PB: {pbVal}</span>}
                                                </div>
                                                <div className="row-mid-times">
                                                    {p.series.map((val, k) => (
                                                        <span key={k} className="time-pill">{val}</span>
                                                    ))}
                                                </div>
                                                <div className="row-bot-avg">
                                                    Promedio: <strong>{p.promedio}s</strong>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : <span className="no-data">Sin tiempos</span>}
                        </div>

                        {/* Footer Stats */}
                        <div className="card-footer-stats">
                            <div className="stat-badge physical"><FaHeartbeat /> {r.estadoFisico}/10</div>
                            <div className="stat-badge mental"><FaBrain /> {r.animo}/5</div>
                            <div className="stat-badge sleep"><FaBed /> {r.sleepHours ?? '-'}h</div>
                            {r.clima?.temp && <div className="stat-badge temp"><FaThermometerHalf/> {r.clima.temp}°</div>}
                        </div>
                    </div>
                </div>
            ))
        )}
      </div>

      <ChartModal isOpen={!!selectedRecord} onClose={() => setSelectedRecord(null)} record={selectedRecord} />

      <ConfirmModal isOpen={showDeleteModal} title="Eliminar Registro" onConfirm={confirmDelete} onCancel={() => setShowDeleteModal(false)} confirmText="Sí, borrar">
        <p>¿Borrar este entrenamiento?</p>
      </ConfirmModal>

      <StatusModal isOpen={showStatusModal} message={statusMessage} onRequestClose={() => setShowStatusModal(false)} />
    </div>
  );
}