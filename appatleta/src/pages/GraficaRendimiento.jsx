import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { 
  ComposedChart, Line, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, AreaChart, ReferenceDot
} from 'recharts';
import { processAnalyticsData, getBestPBs } from '../utils/analyticsHelpers';
import { FaArrowLeft, FaRunning, FaDumbbell, FaWeight, FaBed, FaTrophy, FaFileDownload, FaInfoCircle, FaHistory, FaBroom } from 'react-icons/fa';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import styles from '../styles/GraficaRendimiento.module.css';

// Componente de Tooltip Personalizado para Recharts
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    // Buscar el payload que contenga la información de la lesión
    const injuryPayload = payload.find(p => p.payload.injury);
    
    return (
      <div className={styles.customTooltip}>
        <p className={styles.tooltipDate}>{label}</p>
        {payload.map((entry, index) => (
          <div key={index} style={{ color: entry.color }} className={styles.tooltipItem}>
            <span>{entry.name}:</span>
            <strong>{entry.value} {entry.unit}</strong>
          </div>
        ))}
        {/* Mostrar lesión si está disponible en la data de esa fecha */}
        {injuryPayload && (
          <div className={styles.tooltipInjury}>
            ⚠️ Lesión: {injuryPayload.payload.injury}
          </div>
        )}
        {payload[0].payload.sensaciones && (
           <div style={{marginTop: '5px', fontSize: '0.8rem', color: '#cbd5e1', fontStyle: 'italic'}}>
             "{payload[0].payload.sensaciones}"
           </div>
        )}
      </div>
    );
  }
  return null;
};

export default function GraficaRendimiento() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  
  // Refs para captura de PDF
  const kpiRef = useRef(null);
  const pbChartRef = useRef(null);
  const mainChartRef = useRef(null);
  const secondaryChartRef = useRef(null);
  const sleepChartRef = useRef(null); // Nueva referencia para gráfica de sueño
  
  const [rawData, setRawData] = useState(null);
  const [timeRange, setTimeRange] = useState(3); 
  const [selectedDistance, setSelectedDistance] = useState('100m');
  const [chartData, setChartData] = useState([]);
  
  // Estados para PBs
  const [pbs, setPbs] = useState({});
  const [fullPbHistory, setFullPbHistory] = useState({}); 

  const [loadingData, setLoadingData] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Carga de datos unificada
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        const [trackSnap, gymMonthSnap, gymDaySnap, healthSnap, pbSnap] = await Promise.all([
          getDoc(doc(db, 'registroEntreno', user.email)),
          getDoc(doc(db, 'registrosGym', user.email)),
          getDoc(doc(db, 'registroGymDiario', user.email)),
          getDoc(doc(db, 'healthProfiles', user.email)),
          getDoc(doc(db, 'controlesPB', user.email))
        ]);

        const trackData = trackSnap.exists() ? trackSnap.data().registros : [];
        
        const gymDataFull = [
           ...(gymMonthSnap.exists() ? gymMonthSnap.data().registros : []),
           ...(gymDaySnap.exists() ? gymDaySnap.data().registros : [])
        ];
        
        const healthData = {
           entries: healthSnap.exists() ? healthSnap.data().bodyEntries : [],
           injuries: healthSnap.exists() ? healthSnap.data().injuries : []
        };
        
        const pbDataRaw = pbSnap.exists() ? pbSnap.data() : {};

        setRawData({ trackData, gymData: gymDataFull, healthData });
        
        // Procesar PBs
        setPbs(getBestPBs(pbDataRaw));
        setFullPbHistory(pbDataRaw); 
        
      } catch (error) {
        console.error("Error cargando analíticas:", error);
      } finally {
        setLoadingData(false);
      }
    };
    fetchData();
  }, [user]);

  useEffect(() => {
    if (rawData) {
      const processed = processAnalyticsData(
        rawData.trackData, 
        rawData.gymData, 
        rawData.healthData, 
        pbs, 
        timeRange
      );
      setChartData(processed);
    }
  }, [rawData, timeRange, pbs]);

  // --- LÓGICA GRÁFICA PB ---
  const pbEvolutionData = useMemo(() => {
    if (!fullPbHistory || !selectedDistance) return [];
    
    const history = fullPbHistory[selectedDistance] || [];
    const sorted = [...history].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    
    return sorted.map(item => ({
        date: item.fecha,
        valor: parseFloat(item.valor),
        unit: item.unidad,
        sensaciones: item.sensaciones
    }));
  }, [fullPbHistory, selectedDistance]);

  const isTimeMetric = useMemo(() => {
    if (pbEvolutionData.length > 0) return pbEvolutionData[0].unit === 's';
    return ['m', 'km'].every(u => !selectedDistance.endsWith(u)) || selectedDistance.includes('100m') || selectedDistance.includes('400m');
  }, [pbEvolutionData, selectedDistance]);

  // Cálculo de KPIs
  const kpis = useMemo(() => {
    if (!chartData.length) return {};
    const sessions = chartData.filter(d => d.hasTrack || d.hasGym).length;
    const avgSleep = (chartData.reduce((acc, curr) => acc + (curr.sleep || 0), 0) / (sessions || 1)).toFixed(1);
    const lastWeight = chartData.slice().reverse().find(d => d.weight)?.weight || '--';
    const bestTimeInPeriod = chartData
        .map(d => d[selectedDistance])
        .filter(t => t > 0)
        .sort((a, b) => a - b)[0] || '--';

    return { sessions, avgSleep, lastWeight, bestTimeInPeriod };
  }, [chartData, selectedDistance]);

  const aiExplanation = useMemo(() => {
    if (!chartData.length) return "No hay suficientes datos para analizar.";
    
    const bestTime = kpis.bestTimeInPeriod;
    const pb = pbs[selectedDistance] || '--';
    const improvement = (bestTime !== '--' && pb !== '--') ? (parseFloat(bestTime) - parseFloat(pb)).toFixed(2) : null;
    
    let text = `En los últimos ${timeRange} meses, has realizado ${kpis.sessions} sesiones de entrenamiento. `;
    
    if (improvement !== null) {
      if (improvement <= 0) text += `¡Excelente! Has igualado o superado tu PB en ${selectedDistance}. Tu consistencia está dando frutos. `;
      else text += `Estás a ${improvement}s de tu mejor marca en ${selectedDistance}. Revisa tu descanso y peso corporal. `;
    }
    
    if (parseFloat(kpis.avgSleep) < 7) text += "⚠️ Tu promedio de sueño es bajo (<7h), lo que puede estar limitando tu recuperación y velocidad máxima.";
    else text += "✅ Tu descanso es adecuado, lo que favorece la adaptación muscular.";

    return text;
  }, [kpis, timeRange, selectedDistance, pbs]);

  // --- FUNCIÓN DE EXPORTACIÓN PROFESIONAL ---
  const handleExport = async () => {
    setExporting(true);
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFillColor(15, 23, 42); 
    doc.rect(0, 0, pageWidth, 30, 'F');
    doc.setTextColor(0, 255, 231); 
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORME DE RENDIMIENTO - SPRINTERAPP', pageWidth / 2, 18, { align: 'center' });
    
    let yPos = 40;

    const addSectionToPDF = async (ref, title) => {
        if(ref.current) {
            const originalBg = ref.current.style.backgroundColor;
            ref.current.style.backgroundColor = '#0f172a'; 
            
            const canvas = await html2canvas(ref.current, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            const imgProps = doc.getImageProperties(imgData);
            const pdfWidth = pageWidth - 20;
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            
            if (yPos + pdfHeight > 280) {
                doc.addPage();
                yPos = 20;
            }
            
            if(title) {
                doc.setFontSize(14);
                doc.setTextColor(50, 50, 50);
                doc.text(title, 10, yPos);
                yPos += 8;
            }

            doc.addImage(imgData, 'PNG', 10, yPos, pdfWidth, pdfHeight);
            yPos += pdfHeight + 10;
            
            ref.current.style.backgroundColor = originalBg; 
        }
    };

    try {
        await addSectionToPDF(kpiRef, "Resumen del Periodo");

        doc.setFillColor(240, 240, 240);
        doc.rect(10, yPos, pageWidth - 20, 25, 'F');
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.text("ANÁLISIS TÉCNICO:", 15, yPos + 8);
        doc.setFont('helvetica', 'normal');
        const splitText = doc.splitTextToSize(aiExplanation, pageWidth - 30);
        doc.text(splitText, 15, yPos + 15);
        yPos += 35;

        if (pbEvolutionData.length > 1) {
            await addSectionToPDF(pbChartRef, `Historial de PB: ${selectedDistance}`);
        }

        await addSectionToPDF(mainChartRef, `Evolución Peso Corporal`);
        
        // Agregar las gráficas secundarias
        await addSectionToPDF(secondaryChartRef, "Detalle Peso y Lesiones");
        await addSectionToPDF(sleepChartRef, "Historial de Sueño"); // Nueva exportación

        const pageCount = doc.internal.getNumberOfPages();
        for(let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Generado el ${new Date().toLocaleDateString()} | Pág ${i} de ${pageCount}`, pageWidth / 2, 290, { align: 'center' });
        }

        doc.save(`Rendimiento_${selectedDistance}_${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (err) {
        console.error("Error generando PDF", err);
        alert("Error al generar el reporte.");
    } finally {
        setExporting(false);
    }
  };

  if (loading || loadingData) return <div className={styles.loadingContainer}><div className={styles.spinner}></div></div>;

  return (
    <div className={styles.dashboardContainer}>
      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backBtn} onClick={() => navigate('/home')}>
            <FaArrowLeft />
          </button>
          <h1>Centro de Rendimiento</h1>
        </div>
        
        <div className={styles.controls}>
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(Number(e.target.value))}
            className={styles.select}
          >
            <option value={1}>Último Mes</option>
            <option value={3}>Últimos 3 Meses</option>
            <option value={6}>Últimos 6 Meses</option>
            <option value={12}>Año Completo</option>
          </select>
          
          <button onClick={handleExport} className={styles.exportBtn} disabled={exporting}>
            <FaFileDownload /> {exporting ? 'Generando...' : 'Reporte PDF'}
          </button>
        </div>
      </header>

      {/* KPI CARDS */}
      <div ref={kpiRef} className={styles.pdfSection}>
        <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
            <div className={styles.kpiIcon}><FaRunning /></div>
            <div className={styles.kpiContent}>
                <span className={styles.kpiLabel}>Sesiones</span>
                <span className={styles.kpiValue}>{kpis.sessions}</span>
            </div>
            </div>
            <div className={styles.kpiCard}>
            <div className={styles.kpiIcon} style={{color: '#ffd700'}}><FaTrophy /></div>
            <div className={styles.kpiContent}>
                <span className={styles.kpiLabel}>Mejor {selectedDistance} (Periodo)</span>
                <span className={styles.kpiValue}>{kpis.bestTimeInPeriod}s</span>
                <span className={styles.kpiSubLabel}>PB Histórico: {pbs[selectedDistance] || '--'}s</span>
            </div>
            </div>
            <div className={styles.kpiCard}>
            <div className={styles.kpiIcon} style={{color: '#4ade80'}}><FaWeight /></div>
            <div className={styles.kpiContent}>
                <span className={styles.kpiLabel}>Peso Actual</span>
                <span className={styles.kpiValue}>{kpis.lastWeight} kg</span>
            </div>
            </div>
            <div className={styles.kpiCard}>
            <div className={styles.kpiIcon} style={{color: '#a78bfa'}}><FaBed /></div>
            <div className={styles.kpiContent}>
                <span className={styles.kpiLabel}>Promedio Sueño</span>
                <span className={styles.kpiValue}>{kpis.avgSleep} h</span>
            </div>
            </div>
        </div>
      </div>

      {/* ANÁLISIS AUTOMÁTICO */}
      <div className={styles.aiInsightBox}>
        <div className={styles.aiHeader}>
            <FaInfoCircle /> <span>Análisis de Progreso</span>
        </div>
        <p>{aiExplanation}</p>
      </div>

      {/* GRÁFICA DE RÉCORDS (PB) */}
      {pbEvolutionData.length > 0 ? (
        <div ref={pbChartRef} className={`${styles.chartSection} ${styles.pdfSection}`} style={{border: '1px solid rgba(255, 215, 0, 0.3)'}}>
            <div className={styles.chartHeader}>
                <h3 style={{color: '#ffd700'}}>
                    <FaHistory style={{marginRight: '8px'}} />
                    Trayectoria Histórica
                </h3>
                <div className={styles.chartControls}>
                    <span className={styles.pbBadge} style={{background: 'rgba(255, 215, 0, 0.1)', color: '#ffd700'}}>
                        Récords: {pbEvolutionData.length}
                    </span>
                    <select 
                        value={selectedDistance} 
                        onChange={(e) => setSelectedDistance(e.target.value)}
                        className={styles.metricSelect}
                        style={{ borderColor: '#ffd700', color: '#ffd700' }}
                    >
                        <option value="30m">30m</option>
                        <option value="60m">60m</option>
                        <option value="80m">80m</option>
                        <option value="100m">100m</option>
                        <option value="120m">120m</option>
                        <option value="150m">150m</option>
                        <option value="200m">200m</option>
                        <option value="300m">300m</option>
                        <option value="400m">400m</option>
                        <option value="800m">800m</option>
                        <option value="1500m">1500m</option>
                        <option value="longJump">Salto Longitud</option>
                        <option value="tripleJump">Salto Triple</option>
                    </select>
                </div>
            </div>
            <div className={styles.chartWrapper}>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={pbEvolutionData} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                        <defs>
                            <linearGradient id="colorPb" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ffd700" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#ffd700" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" stroke="#94a3b8" tick={{fontSize: 12}} />
                        
                        {/* Eje Y Invertido si es tiempo, Normal si es distancia */}
                        <YAxis 
                            stroke="#ffd700" 
                            reversed={isTimeMetric} 
                            domain={['dataMin - 0.2', 'dataMax + 0.2']} 
                            unit={pbEvolutionData[0]?.unit || 's'} 
                            width={40} 
                        />
                        
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />

                        <Area 
                            type="stepAfter" 
                            dataKey="valor" 
                            name={`Récord ${selectedDistance}`} 
                            stroke="#ffd700" 
                            fill="url(#colorPb)" 
                            strokeWidth={3}
                            dot={{r: 5, fill: '#ffd700', strokeWidth: 2, stroke: '#000'}}
                            activeDot={{ r: 8 }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
            <div className={styles.chartFooterInfo}>
                <p style={{color: '#ffd700'}}>Gráfica de progresión de registros desde <strong>ControlesPB</strong>. Cada punto es un control oficial registrado.</p>
            </div>
        </div>
      ) : (
        <div className={styles.chartSection} style={{textAlign:'center', color: '#64748b'}}>
             <div className={styles.chartHeader} style={{ justifyContent: 'center', flexDirection: 'column', gap: '10px' }}>
                <h3>No hay datos para {selectedDistance}</h3>
                <select 
                        value={selectedDistance} 
                        onChange={(e) => setSelectedDistance(e.target.value)}
                        className={styles.metricSelect}
                        style={{ borderColor: '#64748b', color: '#64748b' }}
                    >
                        <option value="30m">30m</option>
                        <option value="60m">60m</option>
                        <option value="80m">80m</option>
                        <option value="100m">100m</option>
                        <option value="120m">120m</option>
                        <option value="150m">150m</option>
                        <option value="200m">200m</option>
                        <option value="300m">300m</option>
                        <option value="400m">400m</option>
                        <option value="800m">800m</option>
                        <option value="1500m">1500m</option>
                        <option value="longJump">Salto Longitud</option>
                        <option value="tripleJump">Salto Triple</option>
                </select>
            </div>
            <p>Regístralos en la sección "Controles PB" para ver tu evolución aquí.</p>
        </div>
      )}

      {/* GRÁFICA PRINCIPAL (SOLO PESO CORPORAL) */}
      <div ref={mainChartRef} className={`${styles.chartSection} ${styles.pdfSection}`}>
        <div className={styles.chartHeader}>
          <h3>⚖️ Evolución de Peso Corporal</h3>
        </div>
        <div className={styles.chartWrapper}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
              <defs>
                <linearGradient id="colorWeightMain" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#4ade80" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="displayDate" stroke="#94a3b8" tick={{fontSize: 12}} />
              
              <YAxis 
                stroke="#4ade80" 
                domain={['dataMin - 1', 'dataMax + 1']} 
                unit="kg" 
                width={40}
              />
              
              <Tooltip content={<CustomTooltip />} />
              <Legend />

              <Area 
                type="monotone" 
                dataKey="weight" 
                name="Peso Corporal" 
                stroke="#4ade80" 
                fill="url(#colorWeightMain)" 
                strokeWidth={3} 
                dot={{r: 4, fill: '#4ade80', strokeWidth: 2, stroke: '#0f172a'}}
                activeDot={{ r: 6 }}
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className={styles.chartFooterInfo}>
           <p>Registro de la evolución del peso corporal en el periodo seleccionado.</p>
        </div>
      </div>

      {/* GRÁFICAS SECUNDARIAS */}
      <div className={styles.gridTwoColumns}>
        
        {/* GRÁFICA DE PESO CORPORAL Y LESIONES */}
        <div ref={secondaryChartRef} className={`${styles.chartSection} ${styles.pdfSection}`}>
          <div className={styles.chartHeader}>
            <h3>⚠️ Relación Peso y Lesiones</h3>
            <FaBroom color="#94a3b8" title="Gráfica detallada"/>
          </div>
          <div className={styles.chartWrapperSmall}>
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                    <CartesianGrid stroke="#334155" vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="displayDate" stroke="#94a3b8" fontSize={10} />
                    
                    <YAxis 
                        orientation="right" 
                        stroke="#4ade80" 
                        domain={['dataMin - 2', 'dataMax + 2']} 
                        unit="kg" 
                        width={35}
                        tick={{fontSize: 10}}
                    />
                    
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{fontSize: '10px'}} />
                    
                    <Line 
                        type="monotone" 
                        dataKey="weight" 
                        name="Peso (kg)" 
                        stroke="#4ade80" 
                        strokeWidth={2} 
                        dot={false}
                        connectNulls
                    />

                    {/* Puntos de Referencia para Lesiones */}
                    {chartData
                        .filter(d => d.injury)
                        .map((dataPoint, index) => (
                        <ReferenceDot 
                            key={`injury-${index}`}
                            x={dataPoint.displayDate}
                            y={dataPoint.weight || dataPoint.prevWeight || 'dataMin'}
                            r={5}
                            fill="#f87171" 
                            stroke="#dc2626"
                            strokeWidth={1}
                            isFront
                        >
                            <g>
                                <text x={0} y={0} dy={-8} fill="#f87171" textAnchor="middle" fontSize={12}>⚠️</text>
                            </g>
                        </ReferenceDot>
                    ))}
                </ComposedChart>
            </ResponsiveContainer>
          </div>
           <p className={styles.miniChartExplanation}>Alertas de lesión (⚠️) sobre la curva de peso.</p>
        </div>
        
        {/* GRÁFICA DE ÁNIMO (ESTADO FÍSICO & ÁNIMO) - CORREGIDA PARA RENDERIZARSE CORRECTAMENTE */}
        <div className={styles.chartSection}>
            <div className={styles.chartHeader}>
                <h3>🧠 Estado Físico & Ánimo</h3>
            </div>
            <div className={styles.chartWrapperSmall}>
                {/* Aquí se define el gráfico inline para asegurar que ResponsiveContainer funcione */}
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                        <CartesianGrid stroke="#334155" vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="displayDate" stroke="#94a3b8" fontSize={10} />
                        <YAxis domain={[0, 10]} stroke="#94a3b8" width={30} tick={{fontSize: 10}} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{fontSize: '10px'}} />
                        <Line type="monotone" dataKey="physique" name="Físico (0-10)" stroke="#38bdf8" strokeWidth={2} connectNulls dot={false} />
                        <Line type="monotone" dataKey="mood" name="Ánimo (0-10)" stroke="#fbbf24" strokeWidth={2} connectNulls dot={false} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
             <p className={styles.miniChartExplanation}>Tendencia de percepción subjetiva.</p>
        </div>

        {/* --- NUEVA GRÁFICA: HORAS DE SUEÑO --- */}
        <div ref={sleepChartRef} className={`${styles.chartSection} ${styles.pdfSection}`} style={{gridColumn: '1 / -1'}}>
          <div className={styles.chartHeader}>
            <h3>😴 Historial de Sueño</h3>
            <span className={styles.pbBadge} style={{background: '#a78bfa22', color: '#a78bfa'}}>
                Promedio: {kpis.avgSleep}h
            </span>
          </div>
          <div className={styles.chartWrapperSmall} style={{height: '200px'}}>
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                    <CartesianGrid stroke="#334155" vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="displayDate" stroke="#94a3b8" fontSize={10} />
                    <YAxis 
                        stroke="#a78bfa" 
                        domain={[0, 12]} 
                        unit="h" 
                        width={30}
                        tick={{fontSize: 10}}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{fontSize: '10px'}} />
                    
                    {/* Línea de referencia de 8 horas */}
                    <ReferenceLine y={8} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'Meta (8h)', fill: '#10b981', fontSize: 10, position: 'insideBottomRight' }} />

                    <Bar 
                        dataKey="sleep" 
                        name="Horas de Sueño" 
                        fill="#a78bfa" 
                        barSize={20} 
                        radius={[4,4,0,0]} 
                    />
                </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className={styles.miniChartExplanation}>Registro diario de horas de descanso.</p>
        </div>

      </div>
    </div>
  );
}