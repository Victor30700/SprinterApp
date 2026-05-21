import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { getLatestTime } from '../utils/controlesUtils';
import { EVENTS } from '../utils/events';
import ModalPB from '../components/ModalPB';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import '../styles/ControlesPB.css';
import { FiArrowLeft, FiCopy, FiEdit, FiTrash2, FiSearch, FiDownload } from 'react-icons/fi';

export default function ControlesPB() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  // 1) Dropdown de pruebas y filtro de búsqueda
  const [eventKey, setEventKey] = useState(EVENTS[0].key);
  const event = EVENTS.find(e => e.key === eventKey);
  const [searchKey, setSearchKey] = useState('');

  // 2) Inputs del formulario
  const [distancia, setDistancia] = useState('');
  const [tiempo, setTiempo] = useState('');
  const [fecha, setFecha] = useState(null);
  const [sensaciones, setSensaciones] = useState('');

  // 3) Datos de Firestore
  const [controles, setControles] = useState({});
  const docRef = user?.email && doc(db, 'controlesPB', user.email);

  // 4) Modales y edición
  const [modalType, setModalType] = useState(null);
  const [modalData, setModalData] = useState({});

  useEffect(() => {
    if (!loading && user?.email) loadControles();
  }, [user, loading]);

  async function loadControles() {
    const snap = await getDoc(docRef);
    setControles(snap.exists() ? snap.data() : {});
  }

  function resetForm() {
    setDistancia(''); setTiempo(''); setFecha(null); setSensaciones('');
  }

  // Guardar nuevo control
  const guardarControl = async () => {
    let key = eventKey;
    let valor, unidad;
    const isCustom = eventKey === 'custom';
    if (isCustom) {
      const distVal = parseFloat(distancia);
      const timeVal = parseFloat(tiempo);
      if (isNaN(distVal) || isNaN(timeVal)) return alert('Ingresa distancia y tiempo válidos.');
      key = `${distVal}${event.units[0]}`;
      valor = timeVal;
      unidad = 's';
    } else {
      valor = parseFloat(event.type === 'time' ? tiempo : distancia);
      unidad = event.units[0];
      if (isNaN(valor)) return alert(`Completa el campo de ${event.type === 'time' ? 'tiempo' : 'distancia'}.`);
    }
    const fechaStr = fecha ? fecha.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const nuevo = { fecha: fechaStr, valor, unidad, sensaciones: sensaciones.trim() || '' };
    const data = { ...controles };
    if (data.custom) delete data.custom;
    data[key] = data[key] ? [nuevo, ...data[key]] : [nuevo];
    await setDoc(docRef, data);
    resetForm(); loadControles();
  };

  // Abrir modales (usando fecha+valor como identificador único)
  const openEditModal = (key, idx) => {
    const sorted = [...(controles[key]||[])].sort((a,b)=>b.fecha.localeCompare(a.fecha));
    const rec = sorted[idx];
    setModalData({
      key,
      origFecha: rec.fecha,
      origValor: rec.valor,
      newFecha: null,
      newValor: rec.valor,
      newSensaciones: rec.sensaciones || ''
    });
    setModalType('edit');
  };
  const openDeleteModal = (key, idx) => {
    const sorted = [...(controles[key]||[])].sort((a,b)=>b.fecha.localeCompare(a.fecha));
    const rec = sorted[idx];
    setModalData({ key, origFecha: rec.fecha, origValor: rec.valor });
    setModalType('delete');
  };
  const closeModal = () => setModalType(null);

  // Editar registro
  const handleEdit = async () => {
    const { key, origFecha, origValor, newFecha, newValor, newSensaciones } = modalData;
    const fechaStr = newFecha ? newFecha.toISOString().split('T')[0] : origFecha;
    if (isNaN(newValor)) return alert('Valor inválido');
    const unidad = controles[key][0]?.unidad;
    const recAct = { fecha: fechaStr, valor: newValor, unidad, sensaciones: newSensaciones.trim() || '' };
    const arr = (controles[key]||[]).map(r =>
      r.fecha===origFecha && r.valor===origValor ? recAct : r
    );
    const data = { ...controles, [key]: arr };
    await setDoc(docRef, data);
    closeModal(); loadControles();
  };

  // Eliminar registro
  const handleDelete = async () => {
    const { key, origFecha, origValor } = modalData;
    const arr = (controles[key]||[]).filter(r => !(r.fecha===origFecha && r.valor===origValor));
    const data = { ...controles };
    if (arr.length) data[key]=arr; else delete data[key];
    await setDoc(docRef, data);
    closeModal(); loadControles();
  };

  // Copiar registro
  const copiarRegistro = async r => {
    const texto = `📅 Fecha: ${r.fecha}\n📏 ${r.valor}${r.unidad}${r.sensaciones ? `\n🧠 ${r.sensaciones}` : ''}`;
    await navigator.clipboard.writeText(texto); alert('Copiado');
  };

  // Exportar listado a PDF con tablas
  const downloadPDF = () => {
    const docPDF = new jsPDF();
    docPDF.setFontSize(18);
    docPDF.text('SprinterApp - ControlesPB', 14, 20);
    let startY = 30;

    // Recolectar datos en una sola tabla
    const tableBody = [];
    Object.keys(controles)
      .filter(k => k.includes(searchKey))
      .forEach(k => {
        const recs = controles[k].sort((a,b)=>b.fecha.localeCompare(a.fecha));
        recs.forEach(r => {
          tableBody.push([k, r.fecha, `${r.valor}${r.unidad}`, r.sensaciones || '']);
        });
      });

    docPDF.autoTable({
      startY,
      head: [['Prueba','Fecha','Valor','Sensaciones']],
      body: tableBody,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [22, 160, 133] },
      margin: { left: 14, right: 14 }
    });

    docPDF.save('controlesPB.pdf');
  };

  // Filtrar claves según búsqueda
  const filteredKeys = useMemo(() =>
    Object.keys(controles).filter(k => k.includes(searchKey)),
    [controles, searchKey]
  );

  if (loading) return <p className="controles-empty">Cargando...</p>;
  if (!user) return <p className="controles-empty">Acceso denegado</p>;

  return (
    <div className="controles-container">
      {/* Nuevo HEADER FIJO (Implementación Solicitada) */}
      <div className="controles-header-full">
        <button className="back-button-full" onClick={()=>navigate('/home')}>
          <FiArrowLeft/> Volver
        </button>
      </div>
      <br></br>
      <h2 className="controles-title">Controles PB</h2>

      {/* Buscador (Implementación Solicitada con clase 'search-icon') */}
      <div className="search-box">
        <FiSearch className="search-icon"/>
        <input
          type="text"
          placeholder="Buscar prueba..."
          value={searchKey}
          onChange={e=>setSearchKey(e.target.value)}
        />
      </div>

      {/* Formulario */}
      <div className="controles-form">
        <select value={eventKey} onChange={e=>{setEventKey(e.target.value); resetForm();}}>
          {EVENTS.map(ev=><option key={ev.key} value={ev.key}>{ev.label}</option>)}
        </select>
        {(event.type==='time'||eventKey==='custom')&&(
          <input type="number" placeholder="Tiempo (s)" value={tiempo} onChange={e=>setTiempo(e.target.value)} />
        )}
        {(event.type==='distance'||eventKey==='custom')&&(
          <input type="number" placeholder={`Distancia (${event.units[0]})`} value={distancia} onChange={e=>setDistancia(e.target.value)} />
        )}
        <DatePicker selected={fecha} onChange={setFecha} placeholderText="Fecha (opcional)" className="datepicker-input" />
        <textarea placeholder="Sensaciones (opcional)" value={sensaciones} onChange={e=>setSensaciones(e.target.value)} className="textarea-sensaciones" />
        <button className="btn" onClick={guardarControl}>Guardar</button>
        <button className="btn secondary" onClick={downloadPDF}><FiDownload/> Descargar PDF</button>
      </div>

      {/* Lista de bloques */}
      {filteredKeys.length===0 ? (
        <p className="controles-empty">No hay registros.</p>
      ) : (
        <div className="controles-list">
          {filteredKeys.map(key=>{
            const sorted=[...(controles[key]||[])].sort((a,b)=>b.fecha.localeCompare(a.fecha));
            return (
              <div key={key} className="controles-distance">
                <div className="controles-distance-header">
                  <h3>{key}</h3>
                  <span>Último: {getLatestTime(key,controles)}{sorted[0]?.unidad}</span>
                </div>
                <ul>
                  {sorted.map((r,idx)=>(
                    <li key={`${key}-${r.fecha}-${idx}`} className="controles-item">
                      <div className="registro-content">
                        <div>📅 <strong>{r.fecha}</strong> — 📏 <strong>{r.valor}{r.unidad}</strong>
                          {r.sensaciones&&<div className="sensaciones-text">🧠 {r.sensaciones}</div>}
                        </div>
                        <div className="actions">
                          <button onClick={()=>copiarRegistro(r)} title="Copiar"><FiCopy/></button>
                          <button onClick={()=>openEditModal(key,idx)} title="Editar"><FiEdit/></button>
                          <button onClick={()=>openDeleteModal(key,idx)} title="Eliminar"><FiTrash2/></button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {/* Modales */}
      {modalType==='edit'&&(
        <ModalPB isOpen onRequestClose={closeModal} title="Editar Registro">
          <div className="mb-2">
            <label>Fecha</label>
            <DatePicker selected={modalData.newFecha||new Date(modalData.origFecha)} onChange={d=>setModalData(md=>({...md,newFecha:d}))} />
          </div>
          <div className="mb-2">
            <label>Valor</label>
            <input type="number" value={modalData.newValor} onChange={e=>setModalData(md=>({...md,newValor:parseFloat(e.target.value)}))} />
          </div>
          <div className="mb-2">
            <label>Sensaciones</label>
            <textarea value={modalData.newSensaciones} onChange={e=>setModalData(md=>({...md,newSensaciones:e.target.value}))} className="textarea-sensaciones" />
          </div>
          <button className="modal-action" onClick={handleEdit}>Actualizar</button>
        </ModalPB>
      )}
      {modalType==='delete'&&(
        <ModalPB isOpen onRequestClose={closeModal} title="Eliminar Registro">
          <p>¿Confirma eliminar este registro?</p>
          <button className="modal-action danger" onClick={handleDelete}>Sí, eliminar</button>
          <button className="modal-action" onClick={closeModal}>Cancelar</button>
        </ModalPB>
      )}
    </div>
  );
}