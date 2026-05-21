// src/pages/CalendarioEventos.jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import {
  collection,
  query,
  orderBy,
  getDocs,
  deleteDoc,
  doc
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/CalendarioEventos.module.css';

export default function CalendarioEventos() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const userEventsRef = collection(db, 'userEvents', user?.uid, 'events');

  const cargarEventos = async () => {
    setLoading(true);
    try {
      // ORDEN CORREGIDO: ascendente (eventos más próximos primero)
      const q = query(userEventsRef, orderBy('date', 'asc'));
      const snap = await getDocs(q);

      const arr = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title,
          message: data.message,
          date: data.date.toDate()
        };
      });

      setEvents(arr);
    } catch (err) {
      console.error('Error cargando eventos:', err);
      alert('Error al cargar eventos');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (user?.uid) cargarEventos();
  }, [user?.uid]);

  const handleEditar = (id) => {
    navigate(`/registro-eventos/${id}`);
  };

  const handleEliminar = async id => {
    if (!window.confirm('¿Eliminar este evento?')) return;
    
    try {
      await deleteDoc(doc(db, 'userEvents', user.uid, 'events', id));
      await cargarEventos();
    } catch (err) {
      console.error('Error eliminando evento:', err);
      alert('Error al eliminar evento');
    }
  };

  return (
    <div className={styles.container}>
      <button
        className={styles.btnBack}
        onClick={() => navigate('/home')}
      >
        ← Volver
      </button>

      <h2>🗓️ Mis Eventos</h2>

      <button
        className={styles.btnNew}
        onClick={() => navigate('/registro-eventos')}
      >
        + Nuevo Evento
      </button>

      {loading
        ? <p>Cargando eventos…</p>
        : events.length === 0
          ? <p>No tienes eventos agendados.</p>
          : (
            <ul className={styles.list}>
              {events.map(evt => (
                <li key={evt.id} className={styles.eventCard}>
                  <div className={styles.eventInfo}>
                    <strong>{evt.title}</strong><br/>
                    <small>{evt.date.toLocaleString()}</small>
                  </div>
                  <p>{evt.message}</p>
                  <div className={styles.actions}>
                    <button
                      className={styles.btnEdit}
                      onClick={() => handleEditar(evt.id)}
                    >
                      Editar
                    </button>
                    <button
                      className={styles.btnDelete}
                      onClick={() => handleEliminar(evt.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )
      }
    </div>
  );
}