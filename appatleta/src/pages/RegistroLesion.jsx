// src/pages/RegistroLesion.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { app } from '../config/firebase';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/RegistroLesion.css';

export default function RegistroLesion() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const location = useLocation();
  const db = getFirestore(app);
  const ref = user ? doc(db, 'healthProfiles', user.email) : null;

  const [injuries, setInjuries] = useState([]);
  const [form, setForm] = useState({ name: '', date: '', notes: '', active: 'true' });
  const [editIndex, setEditIndex] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadedRef = useRef(false);

  // Carga inicial solo una vez
  useEffect(() => {
    if (!ref || loadedRef.current) return;
    loadedRef.current = true;
    getDoc(ref).then(snap => {
      const list = snap.exists() ? snap.data().injuries || [] : [];
      list.sort((a, b) => b.date.localeCompare(a.date));
      setInjuries(list);
    });
  }, [ref]);

  // Precarga para editar
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const idx = params.get('edit');
    if (idx !== null && injuries.length > 0) {
      const i = parseInt(idx, 10);
      if (!isNaN(i) && injuries[i]) {
        setForm({
          ...injuries[i],
          active: injuries[i].active ? 'true' : 'false'
        });
        setEditIndex(i);
      }
    }
  }, [location.search, injuries]);

  const handleSubmit = async () => {
    if (isSubmitting || !form.name || !form.date) return;
    setIsSubmitting(true);

    const entry = {
      ...form,
      active: form.active === 'true'
    };

    const updated = [...injuries];
    if (editIndex !== null) {
      updated[editIndex] = entry;
    } else {
      updated.unshift(entry);
    }

    await setDoc(ref, { injuries: updated }, { merge: true });
    setInjuries(updated);    // actualizar localmente
    navigate('/health-profile?view=lesiones');
  };

  return (
    <div className="registro-lesion-container">
      <button className="btn-back" onClick={() => navigate(-1)}>← Volver</button>
      <h3>{editIndex !== null ? 'Editar' : 'Nueva'} Lesión</h3>
      <div className="form-lesion">
        <input
          type="text"
          placeholder="Nombre lesión"
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          disabled={isSubmitting}
        />
        <input
          type="date"
          value={form.date}
          onChange={e => setForm({ ...form, date: e.target.value })}
          disabled={isSubmitting}
        />
        <textarea
          placeholder="Notas (opcional)"
          value={form.notes}
          onChange={e => setForm({ ...form, notes: e.target.value })}
          disabled={isSubmitting}
        />
        <label>
          Estado:
          <select
            value={form.active}
            onChange={e => setForm({ ...form, active: e.target.value })}
            disabled={isSubmitting}
          >
            <option value="true">Activa</option>
            <option value="false">Recuperada</option>
          </select>
        </label>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !form.name || !form.date}
        >
          {isSubmitting ? 'Guardando...' : (editIndex !== null ? 'Actualizar' : 'Guardar')}
        </button>
      </div>
    </div>
  );
}
