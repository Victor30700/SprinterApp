import { format, parseISO, eachDayOfInterval, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

// Normaliza fechas a string YYYY-MM-DD
const formatDate = (date) => format(date instanceof Date ? date : parseISO(date), 'yyyy-MM-dd');

export const processAnalyticsData = (trackData, gymData, healthData, pbs, timeRange = 3) => {
  const endDate = new Date();
  const startDate = subMonths(endDate, timeRange); // Rango dinámico (meses)
  
  // 1. Crear esqueleto de fechas
  const daysInterval = eachDayOfInterval({ start: startDate, end: endDate });
  
  // 2. Procesar Peso y Lesiones (Expandir datos dispersos)
  let lastKnownWeight = null;
  const healthMap = {};
  
  // Ordenar entradas de salud por fecha
  const sortedBody = [...(healthData.entries || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
  
  daysInterval.forEach(day => {
    const dateKey = formatDate(day);
    
    // Buscar registro exacto de peso o usar el último conocido (interpolación simple)
    const entry = sortedBody.find(e => e.date === dateKey);
    if (entry) lastKnownWeight = parseFloat(entry.weightKg);
    
    // Verificar lesiones activas en esta fecha
    const activeInjury = (healthData.injuries || []).find(i => {
      const iDate = new Date(i.date);
      // Asumimos que una lesión dura 14 días si no se marca inactiva (simplificación para gráfica)
      // O si está "activa", la mostramos hasta el día de hoy
      return i.active && iDate <= day;
    });

    healthMap[dateKey] = {
      weight: lastKnownWeight,
      injury: activeInjury ? activeInjury.name : null
    };
  });

  // 3. Unificar todo en la línea de tiempo
  const timeline = daysInterval.map(day => {
    const dateStr = formatDate(day);
    
    // Datos de Pista
    const trackSession = trackData.find(t => t.fecha === dateStr);
    const trackVolume = trackSession ? 
      (trackSession.promedios || []).length : 0; // Cantidad de bloques/series como proxy de volumen
    
    // Tiempos relevantes (aplanamos para graficar)
    const bestTimes = {};
    if (trackSession && trackSession.promedios) {
        trackSession.promedios.forEach(p => {
            if (p.promedio && p.pruebaKey) {
                // Guardamos el tiempo de la prueba (ej: "100m": 10.5)
                if (!bestTimes[p.pruebaKey] || parseFloat(p.promedio) < bestTimes[p.pruebaKey]) {
                    bestTimes[p.pruebaKey] = parseFloat(p.promedio);
                }
            }
        });
    }

    // Datos de Gym
    const gymSession = gymData.find(g => g.fecha === dateStr);
    const gymVolume = gymSession ? (gymSession.ejercicios || []).length : 0;

    return {
      date: dateStr,
      displayDate: format(day, 'dd MMM', { locale: es }),
      
      // Métricas Físicas
      weight: healthMap[dateStr].weight,
      injury: healthMap[dateStr].injury,
      
      // Métricas de Carga
      trackVolume,
      gymVolume,
      totalLoad: trackVolume + gymVolume, // Carga arbitraria combinada
      
      // Métricas Subjetivas (Prioridad pista, luego gym)
      sleep: trackSession?.sleepHours || gymSession?.sleepHours || null,
      mood: trackSession?.animo || gymSession?.animo || null,
      physique: trackSession?.estadoFisico || gymSession?.estadoFisico || null,
      
      // Rendimiento
      ...bestTimes, // Esparce los tiempos (100m, 200m, etc) en el objeto
      hasTrack: !!trackSession,
      hasGym: !!gymSession
    };
  });

  return timeline;
};

export const getBestPBs = (pbs) => {
    const bests = {};
    if (!pbs) return bests;
    
    Object.keys(pbs).forEach(key => {
        if (Array.isArray(pbs[key])) {
            const sorted = [...pbs[key]].sort((a, b) => a.valor - b.valor); // Menor tiempo es mejor
            if (sorted.length > 0) bests[key] = sorted[0].valor;
        }
    });
    return bests;
};