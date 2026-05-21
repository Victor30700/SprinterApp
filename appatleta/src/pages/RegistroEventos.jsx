// src/pages/RegistroEventos.jsx

import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  setDoc,
  Timestamp
} from 'firebase/firestore';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import styles from '../styles/RegistroEventos.module.css';

export default function RegistroEventos() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();

  // Estados del formulario
  const [fecha, setFecha] = useState(() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
  });
  const [titulo, setTitulo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [advanceDays, setAdvanceDays] = useState(14);

  // Los datos originales (solo se cargan al editar)
  const [originalData, setOriginalData] = useState(null);

  if (loading) return <p>Cargando usuario…</p>;
  if (!user) return <Navigate to="/login" replace />;

  // Referencia a la subcolección de eventos del usuario
  const userEventsRef = collection(db, 'userEvents', user.uid, 'events');

  // Cargar evento para edición y guardar originalData
  useEffect(() => {
    if (!id) return;

    (async () => {
      const docRef = doc(db, 'userEvents', user.uid, 'events', id);
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        alert('Evento no encontrado');
        return navigate('/calendario-eventos');
      }

      const data = snap.data();
      setOriginalData(data);

      // Cargar valores en el formulario
      setFecha(data.date.toDate());
      setTitulo(data.title);
      setMensaje(data.message);
      setAdvanceDays(data.advanceDays);
    })();
  }, [id, user.uid, navigate]);

  // Manejo de cambio de fecha: conserva la hora
  const handleDateChange = newDate => {
    const d = new Date(newDate);
    d.setHours(fecha.getHours(), fecha.getMinutes(), fecha.getSeconds());
    setFecha(d);
  };

  // Manejo de cambio de hora
  const handleTimeChange = e => {
    const [h, m] = e.target.value.split(':').map(Number);
    const d = new Date(fecha);
    d.setHours(h, m);
    setFecha(d);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!titulo.trim()) return alert('El título es obligatorio.');

    // Construimos el payload base
    const payload = {
      title: titulo.trim(),
      message: mensaje.trim(),
      date: Timestamp.fromDate(fecha),
      advanceDays,
      userId: user.uid,
      // Flags de notificación
      advanceNotificationSent: false,
      exactNotificationSent: false,
      // createdAt: si editamos, lo sobreescribiremos más abajo
      createdAt: Timestamp.now()
    };

    // Si estamos editando, ajustamos flags y createdAt
    if (id && originalData) {
      // Fecha original como JS Date
      const origDate = originalData.date.toDate();
      const origAdvance = originalData.advanceDays;

      // Conservar createdAt original
      payload.createdAt = originalData.createdAt || payload.createdAt;

      // Si la fecha o days-advance cambió, dejamos false
      if (
        fecha.getTime() !== origDate.getTime() ||
        advanceDays !== origAdvance
      ) {
        payload.advanceNotificationSent = false;
        payload.exactNotificationSent = false;
      } else {
        // Si no cambió, conservamos los flags originales
        payload.advanceNotificationSent =
          originalData.advanceNotificationSent ?? false;
        payload.exactNotificationSent =
          originalData.exactNotificationSent ?? false;
      }

      // Guardar con setDoc (merge opcional)
      await setDoc(
        doc(db, 'userEvents', user.uid, 'events', id),
        payload,
        { merge: true }
      );
    } else {
      // Nuevo registro
      await addDoc(userEventsRef, payload);
    }

    navigate('/calendario-eventos');
  };

  return (
    <div className={styles.container}>
      <button
        className={styles.btnBack}
        onClick={() => navigate(-1)}
      >
        ← Volver
      </button>

      <h2>📅 {id ? 'Editar Evento' : 'Nuevo Evento'}</h2>

      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Fecha y Hora */}
        <div className={styles.datetimeContainer}>
          <div>
            <label htmlFor="fecha">Fecha del evento</label>
            <Calendar
              onChange={handleDateChange}
              value={fecha}
              className={styles.calendar}
              id="fecha"
              minDate={new Date()}
            />
          </div>
          <div>
            <label htmlFor="hora">Hora de notificación</label>
            <div className={styles.timeInputWrapper}>
              <span className={styles.timeIcon}>⏰</span>
              <input
                id="hora"
                type="time"
                value={`${String(fecha.getHours()).padStart(2, '0')}:${String(
                  fecha.getMinutes()
                ).padStart(2, '0')}`}
                onChange={handleTimeChange}
                className={styles.inputTime}
                required
              />
            </div>
          </div>
        </div>

        {/* Título */}
        <label htmlFor="titulo">Título del evento</label>
        <input
          id="titulo"
          type="text"
          value={titulo}
          onChange={e => setTitulo(e.target.value)}
          className={styles.input}
          placeholder="Ej: Reunión importante"
          maxLength={50}
          required
        />

        {/* Mensaje */}
        <label htmlFor="mensaje">Mensaje de recordatorio</label>
        <textarea
          id="mensaje"
          value={mensaje}
          onChange={e => setMensaje(e.target.value)}
          className={styles.textarea}
          rows={3}
          placeholder="Ej: No olvides los documentos!"
          maxLength={200}
        />

        {/* Días de antelación */}
        <label htmlFor="aviso">Programar notificación</label>
        <select
          id="aviso"
          value={advanceDays}
          onChange={e => setAdvanceDays(Number(e.target.value))}
          className={styles.input}
        >
          <option value={14}>2 semanas antes</option>
          <option value={7}>1 semana antes</option>
          <option value={5}>5 días antes</option>
          <option value={4}>4 días antes</option>
          <option value={3}>3 días antes</option>
          <option value={2}>2 días antes</option>
          <option value={1}>1 día antes</option>
        </select>

        <button type="submit" className={styles.btnAdd}>
          {id ? 'Guardar Cambios' : 'Crear Evento'}
        </button>
      </form>
    </div>
  );
}
