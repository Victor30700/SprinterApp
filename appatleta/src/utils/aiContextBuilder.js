import { format, parseISO, subDays, isAfter, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

export const buildAthleteContext = (profile, trainings, gym, pbs, health, videos = []) => {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  
  // 1. Pre-cálculo de Métricas (Igual que en tus gráficas)
  const last30Days = subDays(today, 30);
  
  // Consistencia
  const recentTrainings = trainings.filter(t => isAfter(parseISO(t.fecha), last30Days));
  const recentGym = gym.filter(g => isAfter(parseISO(g.fecha), last30Days));
  const totalSessions = recentTrainings.length + recentGym.length;
  
  // Sueño (Promedio últimos 10 registros para detectar tendencia actual)
  const allSessionsSorted = [...trainings, ...gym].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  const sleepData = allSessionsSorted
    .map(s => Number(s.sleepHours))
    .filter(h => !isNaN(h) && h > 0)
    .slice(0, 10); // Últimos 10
  
  const avgSleep = sleepData.length > 0 
    ? (sleepData.reduce((a, b) => a + b, 0) / sleepData.length).toFixed(1) 
    : '--';

  // Tendencia de Peso
  const weightEntries = health.entries.sort((a, b) => new Date(b.date) - new Date(a.date));
  const currentWeight = weightEntries[0]?.weightKg || '--';
  // Buscar peso de hace aprox 1 mes para comparar
  const prevWeightEntry = weightEntries.find(w => differenceInDays(today, parseISO(w.date)) > 20) || weightEntries[weightEntries.length - 1];
  const prevWeight = prevWeightEntry?.weightKg || currentWeight;
  
  let weightTrend = "Estable";
  if (currentWeight !== '--' && prevWeight !== '--') {
    const diff = parseFloat(currentWeight) - parseFloat(prevWeight);
    if (diff > 0.8) weightTrend = `Tendencia al alza (+${diff.toFixed(1)}kg)`;
    else if (diff < -0.8) weightTrend = `Tendencia a la baja (${diff.toFixed(1)}kg)`;
  }

  // --- CONSTRUCCIÓN DEL CONTEXTO (PROMPT) ---

  let context = `ROL: Eres Coach Nova, un entrenador olímpico de élite. Tu análisis se basa estrictamente en los datos biomecánicos, tiempos reales y contexto del atleta. NO inventes datos.\n\n`;
  
  context += `📋 REPORTE DE ESTADO ACTUAL (${todayStr})\n`;
  
  // 1. Perfil y Métricas de Salud
  context += `🔹 FISIOLOGÍA Y SALUD:\n`;
  if (profile) {
    context += `- Atleta: ${profile.fullName || 'Atleta'} (${profile.tipoCorredor || 'General'}) | Edad: ${profile.age || '--'}\n`;
  }
  context += `- Composición Corporal: ${currentWeight}kg | Altura: ${weightEntries[0]?.heightM || '--'}m | ${weightTrend}\n`;
  context += `- Recuperación (Sueño): ${avgSleep} horas/noche (Promedio reciente). ${parseFloat(avgSleep) < 7 ? '⚠️ ALERTA: Sueño insuficiente.' : '✅ Descanso adecuado.'}\n`;
  
  // 2. Estado de Lesiones (CRÍTICO)
  const activeInjuries = health.injuries.filter(i => i.active);
  if (activeInjuries.length > 0) {
    context += `\n🚨 ALERTA MÉDICA - LESIONES ACTIVAS:\n`;
    activeInjuries.forEach(i => {
        context += `  - ${i.name} (Desde: ${i.date}): ${i.notes || ''}\n`;
    });
    context += `  PROTOCOLO: Adapta todas las sugerencias para evitar impacto en estas zonas.\n`;
  } else {
    context += `- Estado Clínico: 🟢 100% APTO (Sin lesiones activas).\n`;
  }

  // 3. Rendimiento y PBs
  context += `\n🏆 RENDIMIENTO Y MARCAS (PBs):\n`;
  if (pbs && pbs.length > 0) {
    const bestPBs = {}; 
    pbs.forEach(pb => {
      if (!bestPBs[pb.prueba] || pb.valor < bestPBs[pb.prueba]) {
        bestPBs[pb.prueba] = pb.valor;
      }
    });
    Object.entries(bestPBs).forEach(([dist, time]) => {
      context += `- ${dist}: ${time}s\n`;
    });
  } else {
    context += "  (Sin registros de PB aún)\n";
  }

  // 4. Análisis de Carga Reciente (Lo que se ve en las gráficas)
  context += `\n📊 ANÁLISIS DE CARGA RECIENTE (Últimos 30 días):\n`;
  context += `- Volumen: ${totalSessions} sesiones totales (Pista + Gym).\n`;
  
  // 5. Entrenamientos Pista (DETALLADO)
  // IMPORTANTE: Tomamos los últimos 5 entrenamientos para dar contexto inmediato
  context += `\n🏃 ÚLTIMAS SESIONES DE PISTA (Orden Cronológico):\n`;
  
  trainings.slice(-5).forEach(t => {
    // Detectar enfoque
    let enfoque = "Técnica/Rodaje";
    if (t.series?.some(s => (s.distancia || s.pruebaKey || '').match(/30m|60m|80m/))) enfoque = "Velocidad Pura/Aceleración";
    else if (t.series?.some(s => (s.distancia || s.pruebaKey || '').match(/150m|200m|300m/))) enfoque = "Resistencia a la Velocidad";
    else if (t.series?.some(s => (s.distancia || s.pruebaKey || '').match(/400m|500m|600m/))) enfoque = "Tolerancia al Lactato";
    
    // Datos Ambientales y Equipo
    const vientoStr = t.clima?.wind ? `${t.clima.wind}m/s` : 'N/D';
    const tempStr = t.clima?.temp ? `${t.clima.temp}°C` : 'N/D';
    const calzadoStr = t.calzado ? t.calzado.toUpperCase() : 'N/D';

    context += `\n📅 FECHA: ${t.fecha} [${enfoque}]\n`;
    context += `   CONTEXTO: Viento: ${vientoStr} | Temp: ${tempStr} | Calzado: ${calzadoStr}\n`;
    context += `   PLAN: "${t.plan || 'Sin descripción'}"\n`;
    context += `   ESTADO: Físico ${t.estadoFisico}/10 | Ánimo ${t.animo}/5\n`;
    context += `   TIEMPOS REALES (SERIES):\n`;
    
    if (t.promedios && t.promedios.length > 0) {
      t.promedios.forEach((bloque, idx) => {
        // Extraemos tiempos
        const tiemposRaw = bloque.series ? `[${bloque.series.filter(val => val).join(', ')}]` : '[]';
        
        // [MEJORA CLAVE] Agregar información de PAUSAS al contexto de la IA
        let infoPausa = `Pausa: ${bloque.pausa || '?'}min`;
        if (bloque.macro && bloque.macro.at && bloque.macro.time) {
            infoPausa += ` | MACRO PAUSA de ${bloque.macro.time}min tras la repetición #${bloque.macro.at}`;
        }

        context += `     📍 ${bloque.pruebaKey} (Bloque ${idx + 1}): Series=${tiemposRaw} | Promedio=${bloque.promedio}s | ${infoPausa}\n`;
      });
    } else {
        context += `     (Sin tiempos registrados)\n`;
    }
  });

  // 6. Gym (Últimas sesiones)
  if (gym.length > 0) {
    // Tomamos los primeros 3 (asumiendo que en ChatGPTPage vienen ordenados del más reciente al más antiguo)
    const lastGymSessions = gym.slice(0, 3);
    
    context += `\n🏋️ ÚLTIMAS SESIONES DE GYM:\n`;
    lastGymSessions.forEach(g => {
        context += `   📅 ${g.fecha} (${g.zona || 'General'}): ${g.plan || ''}\n`;
        if(g.ejercicios && Array.isArray(g.ejercicios)) {
            const ejercicios = g.ejercicios.slice(0, 5).map(e => {
                const maxWeight = e.pesos ? Math.max(...e.pesos.map(p => Number(p) || 0)) : 0;
                return `${e.nombre}: ${maxWeight}${g.unidadPeso || 'kg'}`;
            }).join(' | ');
            context += `      Cargas: ${ejercicios}\n`;
        }
    });
  }

  // --- NUEVA SECCIÓN: ANÁLISIS DE VIDEO (BIOMECÁNICA) ---
  if (videos && videos.length > 0) {
    context += `\n🎥 BIBLIOTECA DE ANÁLISIS DE VIDEO (Últimos registros):\n`;
    
    videos.forEach(v => {
      const fechaVideo = v.createdAt ? format(v.createdAt, 'yyyy-MM-dd HH:mm') : 'Fecha desconocida';
      const estado = v.status === 'completed' ? '✅ Procesado' : '⏳ En proceso';
      
      context += `   📅 ${fechaVideo} | Título: "${v.title}"\n`;
      context += `      📝 Descripción del atleta: "${v.description}"\n`;
      context += `      ℹ️ Estado: ${estado} | ID: ${v.id}\n`;
      
      // LÓGICA CORREGIDA: Mostrar TODO lo que el backend genere
      if (v.status === 'completed') {
          // 1. Mostrar resumen narrativo si existe
          if (v.aiSummary) {
             context += `      🤖 DIAGNÓSTICO IA: ${v.aiSummary}\n`;
          }
          // 2. Mostrar métricas técnicas si existen (Ángulos, etc.)
          if (v.metricsSummary) {
             // Convertimos el objeto de métricas en un string legible
             const metricsStr = Object.entries(v.metricsSummary)
                .map(([key, val]) => `${key}: ${val}`)
                .join(' | ');
             context += `      📐 DATOS TÉCNICOS: { ${metricsStr} }\n`;
          }
      }
      context += `      -----------------------------------\n`;
    });
    
    context += `\n   INSTRUCCIÓN DE VIDEO: Si el atleta pregunta por su técnica, utiliza tanto el "DIAGNÓSTICO IA" como los "DATOS TÉCNICOS" (ej: ángulos del tronco) para dar una respuesta precisa. Cruza esto con sus sensaciones en la pista.\n`;
  } else {
    context += `\n🎥 VIDEOS: No hay videos subidos recientemente para análisis.\n`;
  }

  return context;
};