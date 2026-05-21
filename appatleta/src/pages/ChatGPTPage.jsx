import React, { useState, useRef, useEffect } from 'react';
import { Copy, Send, Trash2, Download, Bot, User, ArrowLeft, Loader2 } from 'lucide-react';
import { sendMessageToGPT } from '../config/openai';
import { useAuth } from '../context/AuthContext';
// IMPORTS ACTUALIZADOS: Agregamos onSnapshot para tiempo real
import { getFirestore, doc, getDoc, collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { app } from '../config/firebase';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import { buildAthleteContext } from '../utils/aiContextBuilder';
import ReactMarkdown from 'react-markdown'; 
import remarkGfm from 'remark-gfm';
import '../styles/ChatGPTPage.css';

export default function ChatGPTPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const db = getFirestore(app);
  const messagesEndRef = useRef(null);

  const [systemContext, setSystemContext] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `### 🚀 Sistema Coach Nova Iniciado
Hola atleta. He conectado con tu base de datos de alto rendimiento.

Tengo acceso en tiempo real a:
* 📹 **Análisis Biomecánico** de tus videos.
* ⏱️ **Tiempos de Pista** y fatiga.
* 🏋️ **Cargas de Gimnasio**.

¿Analizamos tu técnica de carrera o planificamos la semana?`
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  // Almacén para datos estáticos (Perfil, Pista, Gym, etc. que no cambian segundo a segundo)
  const [staticData, setStaticData] = useState(null);

  // --- 1. CARGA DE DATOS ESTÁTICOS (Una sola vez) ---
  useEffect(() => {
    const fetchStaticData = async () => {
      if (!user) return;
      try {
        setLoadingData(true);
        
        // 1. Perfil
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        const userData = userSnap.exists() ? userSnap.data() : null;

        // 2. Pista (Ordenado por fecha: Antiguo -> Nuevo)
        const trackSnap = await getDoc(doc(db, 'registroEntreno', user.email));
        const trackData = trackSnap.exists() ? trackSnap.data().registros : [];
        trackData.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

        // 3. Gym
        const gymMensualSnap = await getDoc(doc(db, 'registrosGym', user.email));
        const gymDiarioSnap = await getDoc(doc(db, 'registroGymDiario', user.email));
        let gymData = [];
        if (gymDiarioSnap.exists()) gymData = [...gymData, ...gymDiarioSnap.data().registros];
        gymData.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        // 4. PBs
        const pbSnap = await getDoc(doc(db, 'controlesPB', user.email));
        let pbData = [];
        if (pbSnap.exists()) {
          const data = pbSnap.data();
          Object.keys(data).forEach(key => {
            if(Array.isArray(data[key])) data[key].forEach(reg => pbData.push({...reg, prueba: key}));
          });
        }

        // 5. Salud
        const healthSnap = await getDoc(doc(db, 'healthProfiles', user.email));
        const healthData = {
            entries: healthSnap.exists() ? (healthSnap.data().bodyEntries || []) : [],
            injuries: healthSnap.exists() ? (healthSnap.data().injuries || []) : []
        };
        healthData.entries.sort((a,b) => new Date(b.date) - new Date(a.date));

        // Guardamos todo en el estado para usarlo cuando lleguen los videos en tiempo real
        setStaticData({ userData, trackData, gymData, pbData, healthData });

      } catch (error) {
        console.error("Error cargando datos estáticos:", error);
      }
    };
    fetchStaticData();
  }, [user, db]);

  // --- 2. LISTENER EN TIEMPO REAL PARA VIDEOS ---
  // Este efecto se activa cuando ya tenemos los staticData y escucha cambios en Firestore
  useEffect(() => {
    if (!user || !staticData) return;

    const videosRef = collection(db, 'userVideos', user.uid, 'videos');
    // Traemos los últimos 5 para contexto reciente
    const q = query(videosRef, orderBy('createdAt', 'desc'), limit(5));

    // onSnapshot: Escucha activa. Si el backend Python actualiza el estado, esto se dispara.
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const videoData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      }));

      // Reconstruimos el contexto completo con los datos estáticos + videos frescos
      const contextString = buildAthleteContext(
        staticData.userData, 
        staticData.trackData, 
        staticData.gymData, 
        staticData.pbData, 
        staticData.healthData, 
        videoData // <--- Aquí entran los videos actualizados
      );
      
      const systemPrompt = `
        Actúa como **Coach Nova**, un entrenador de alto rendimiento especializado en atletismo (velocidad y potencia).
        
        TIENES ACCESO A LOS DATOS CRUDOS DE CADA SERIE Y A LOS ANÁLISIS DE VIDEO EN TIEMPO REAL.
        
        EXPEDIENTE DEL ATLETA:
        ${contextString}

        ### INSTRUCCIONES DE ANÁLISIS PROFUNDO:
        
        1. **ANÁLISIS DE TIEMPOS (LO MÁS IMPORTANTE):**
           - Cuando el atleta pregunte por su sesión, mira el array "Series" (ej: [7.47, 7.12, 7.22, 7.09]).
           - **Identifica el Mejor Tiempo (SB del día)**: Compara este valor específico con su PB histórico.
           - **Calcula la Fatiga Intra-sesión**: Diferencia entre el peor y mejor tiempo. Si hay mucha varianza, coméntalo.
           - **Consistencia**: Si los tiempos son muy estables (ej: todos en 7.2x), elogia la consistencia.

        2. **INTEGRACIÓN DE VIDEO Y BIOMECÁNICA (PRIORIDAD ALTA):**
           - Tienes acceso a la "BIBLIOTECA DE ANÁLISIS DE VIDEO".
           - **SI HAY DATOS TÉCNICOS**: Usa los valores numéricos (ej: ángulos) para validar la técnica. 
             - Ejemplo: "Tu inclinación de tronco es 48°, lo cual es excelente para la fase de aceleración".
           - **SI HAY DIAGNÓSTICO IA**: Usa el resumen narrativo del backend para complementar tu respuesta.
           - Relaciona lo que ves en los datos del video con los tiempos realizados ese día.

        3. **CONTEXTO AMBIENTAL Y EQUIPO:**
           - **Viento**: Si el viento es > +2.0 m/s, advierte que los tiempos no son homologables. Si es negativo, valora el esfuerzo.
           - **Calzado**: Si usa CLAVOS (Spikes), exige tiempos rápidos. Si usa Zapatillas, sé tolerante.

        4. **ESTADO FÍSICO Y RECUPERACIÓN:**
           - Cruza el rendimiento con el sueño y el estado físico reportado.

        5. **FORMATO DE RESPUESTA:**
           - Sé directo, técnico y motivador.
           - Usa Markdown: **Negritas** para datos clave, Listas para puntos.
           - Estructura: 
             - 📊 **Diagnóstico** (Comparativa PB vs Mejor tiempo de hoy).
             - 🔬 **Análisis Técnico/Video** (Si aplica, usa los datos biomecánicos).
             - 🧠 **Conclusión y Consejos**.
      `;

      setSystemContext(systemPrompt);
      setLoadingData(false); // Datos listos y sincronizados
      console.log("Contexto IA actualizado con videos en tiempo real.");
    });

    // Limpiar suscripción al desmontar componente
    return () => unsubscribe();

  }, [user, db, staticData]); // Se vuelve a ejecutar si staticData cambia (lo cual pasa una vez al inicio)

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    const newUserMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, newUserMsg]);
    setInput('');
    setLoading(true);

    try {
      const recentMessages = messages.slice(-8); 
      const payload = [{ role: 'system', content: systemContext }, ...recentMessages, newUserMsg];
      const replyContent = await sendMessageToGPT(payload);
      setMessages(prev => [...prev, { role: 'assistant', content: replyContent }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ **Error de conexión.** Verifica tu internet e intenta de nuevo.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([{ role: 'assistant', content: 'Chat reiniciado. **¿Cuál es el siguiente objetivo?** 🎯' }]);
  };

  const handleDownloadPDF = () => {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.width;
    let y = 20;
    
    // Header Profesional
    pdf.setFillColor(15, 23, 42); // Azul oscuro corporativo
    pdf.rect(0, 0, pageWidth, 40, 'F');
    
    pdf.setTextColor(0, 255, 231); // Cian Neón
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    pdf.text('COACH NOVA - INFORME TÉCNICO', pageWidth / 2, 25, { align: 'center' });
    
    pdf.setFontSize(10);
    pdf.setTextColor(200, 200, 200);
    pdf.text(`Generado: ${new Date().toLocaleDateString()}`, pageWidth / 2, 32, { align: 'center' });
    
    y = 55;
    
    messages.slice(1).forEach(msg => {
      // Manejo de salto de página
      if (y > 270) { pdf.addPage(); y = 30; }
      
      const isUser = msg.role === 'user';
      
      // Etiqueta del rol
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(isUser ? 100 : 0, isUser ? 100 : 0, isUser ? 100 : 0);
      pdf.text(isUser ? 'ATLETA' : 'ANÁLISIS TÉCNICO', 20, y);
      
      // Línea separadora
      pdf.setDrawColor(200, 200, 200);
      pdf.line(20, y + 2, pageWidth - 20, y + 2);
      y += 8;
      
      // Contenido
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.setTextColor(40, 40, 40);
      
      // Limpieza básica de Markdown para PDF
      const cleanText = msg.content
        .replace(/\*\*/g, '')
        .replace(/###/g, '')
        .replace(/- /g, '• ');
        
      const lines = pdf.splitTextToSize(cleanText, 170);
      pdf.text(lines, 20, y);
      
      y += (lines.length * 6) + 15; // Espacio entre mensajes
    });
    
    pdf.save(`CoachNova_Reporte_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  return (
    <div className="chat-container">
      {/* HEADER */}
      <header className="chat-header-pro">
        <div className="header-left">
          <button className="btn-back-pro" onClick={() => navigate('/home')}>
            <ArrowLeft size={18} style={{marginRight: '6px'}}/> <span className="hide-mobile">Volver</span>
          </button>
          <div className="bot-identity">
            <div className={`status-dot ${loadingData ? 'loading' : 'online'}`}></div>
            <div>
              <h1>Coach Nova <span>PRO</span></h1>
              <p>{loadingData ? 'Sincronizando datos...' : 'Asistente de Alto Rendimiento'}</p>
            </div>
          </div>
        </div>
        <div className="header-actions">
          <button onClick={handleClearChat} className="action-icon" title="Limpiar sesión">
            <Trash2 size={20}/>
          </button>
          <button onClick={handleDownloadPDF} className="action-icon" title="Descargar Informe PDF">
            <Download size={20}/>
          </button>
        </div>
      </header>

      {/* CHAT AREA */}
      <div className="chat-viewport">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-row ${msg.role}`}>
            <div className="avatar">
              {msg.role === 'assistant' ? <Bot size={24} /> : <User size={24} />}
            </div>
            <div className="bubble">
              <div className="bubble-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content}
                </ReactMarkdown>
              </div>
              <button 
                className="copy-text" 
                onClick={() => navigator.clipboard.writeText(msg.content)}
                title="Copiar"
              >
                <Copy size={14} />
              </button>
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="chat-row assistant">
            <div className="avatar"><Bot size={24} /></div>
            <div className="bubble typing-indicator">
              <Loader2 className="animate-spin" size={20} />
              <span style={{marginLeft: '10px'}}>Analizando datos...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT */}
      <div className="input-zone">
        <div className="input-wrapper">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder={loadingData ? "Cargando registros..." : "Consulta sobre tu entrenamiento, dieta o videos..."}
            disabled={loadingData || loading}
          />
          <button 
            onClick={handleSend} 
            disabled={loadingData || loading || !input.trim()}
            className={loading ? 'sending' : ''}
          >
            <Send size={20} />
          </button>
        </div>
        <div className="input-footer">
          IA v2.6 | Optimización con Análisis de Video
        </div>
      </div>
    </div>
  );
}