// src/pages/RegistroPesoCorporal.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { app } from '../config/firebase';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/RegistroPesoCorporal.css';

export default function RegistroPesoCorporal() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const location = useLocation();
  const db = getFirestore(app);
  const ref = user ? doc(db, 'healthProfiles', user.email) : null;

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    weightKg: '',
    heightM: '',
    bodyFat: '',
    activityLevel: '',
    notes: ''
  });
  const [entries, setEntries] = useState([]);
  const [editIndex, setEditIndex] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  // Sólo cargamos desde Firestore una vez al montar:
  const loadedRef = useRef(false);
  useEffect(() => {
    if (!ref || loadedRef.current) return;
    loadedRef.current = true;
    (async () => {
      const snap = await getDoc(ref);
      const list = snap.exists() ? snap.data().bodyEntries || [] : [];
      list.sort((a, b) => b.date.localeCompare(a.date));
      setEntries(list);
    })();
  }, [ref]);

  // Cuando llegamos con ?edit= i, precargamos el form una sola vez
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const idx = params.get('edit');
    if (idx !== null && entries.length) {
      const i = parseInt(idx, 10);
      if (!isNaN(i) && entries[i]) {
        const e = entries[i];
        setForm({
          date: e.date,
          weightKg: e.weightKg,
          heightM: e.heightM,
          bodyFat: e.bodyFat ? e.bodyFat.replace('%','') : '',
          activityLevel: e.activityLevel || '',
          notes: e.notes || ''
        });
        setEditIndex(i);
        setResult(e);
      }
    }
  }, [location.search, entries]);

  const handleSubmit = async () => {
    if (isSubmitting) return;
    const kg = parseFloat(form.weightKg);
    const m  = parseFloat(form.heightM);
    if (!(kg > 0 && m > 0)) return;

    setIsSubmitting(true);
    try {
      // conversiones y cálculos
      const lbs         = kg * 2.20462;
      const totalInches = m * 39.3701;
      const ft          = Math.floor(totalInches / 12);
      const inch        = (totalInches % 12).toFixed(1);
      const bmi         = kg / (m * m);
      const category    = bmi < 18.5 ? 'Bajo peso'
                        : bmi < 25   ? 'Normal'
                        : bmi < 30   ? 'Sobrepeso'
                                     : 'Obesidad';
      const minIdeal    = 18.5 * m * m;
      const maxIdeal    = 24.9 * m * m;

      const entry = {
        ...form,
        weightKg:      kg.toFixed(1),
        weightLbs:     lbs.toFixed(1),
        heightM:       m.toFixed(2),
        heightFt:      `${ft}′${inch}″`,
        bmi:           bmi.toFixed(1),
        category,
        idealMinKg:    minIdeal.toFixed(1),
        idealMaxKg:    maxIdeal.toFixed(1),
        bodyFat:       form.bodyFat ? `${form.bodyFat}%` : null,
        activityLevel: form.activityLevel || null,
        notes:         form.notes.trim() || null
      };

      const updated = [...entries];
      if (editIndex !== null) {
        updated[editIndex] = entry;
      } else {
        updated.unshift(entry);
      }

      await setDoc(ref, { bodyEntries: updated }, { merge: true });
      setEntries(updated);              // actualizamos localmente
      navigate('/health-profile?view=peso');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="registro-peso-container">
      <button className="btn-back" onClick={() => navigate(-1)}>← Volver</button>
      <h3>{editIndex !== null ? 'Editar' : 'Nuevo'} Registro Corporal</h3>

      <div className="form-body">
        <label>
          Fecha:
          <input
            type="date"
            value={form.date}
            onChange={e => setForm({ ...form, date: e.target.value })}
            disabled={isSubmitting}
          />
        </label>
        <label>
          Peso (kg):
          <input
            type="number"
            step="0.1"
            value={form.weightKg}
            onChange={e => setForm({ ...form, weightKg: e.target.value })}
            disabled={isSubmitting}
          />
        </label>
        <label>
          Altura (m):
          <input
            type="number"
            step="0.01"
            value={form.heightM}
            onChange={e => setForm({ ...form, heightM: e.target.value })}
            disabled={isSubmitting}
          />
        </label>
        <label>
          % Grasa corporal:
          <input
            type="number"
            step="0.1"
            value={form.bodyFat}
            onChange={e => setForm({ ...form, bodyFat: e.target.value })}
            disabled={isSubmitting}
          />
        </label>
        <label>
          Nivel de actividad:
          <select
            value={form.activityLevel}
            onChange={e => setForm({ ...form, activityLevel: e.target.value })}
            disabled={isSubmitting}
          >
            <option value="">Selecciona...</option>
            <option value="Bajo">Bajo</option>
            <option value="Moderado">Moderado</option>
            <option value="Alto">Alto</option>
          </select>
        </label>
        <label>
          Notas:
          <textarea
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            disabled={isSubmitting}
          />
        </label>
        <button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : (editIndex !== null ? 'Actualizar' : 'Guardar y calcular')}
        </button>
      </div>

      {result && (
        <div className="bmi-result">
          <p>Peso: {result.weightKg} kg ({result.weightLbs} lbs)</p>
          <p>Altura: {result.heightM} m ({result.heightFt})</p>
          <p>IMC: <strong>{result.bmi}</strong> ({result.category})</p>
          <p>Rango IMC normal → peso ideal: {result.idealMinKg}–{result.idealMaxKg} kg</p>
        </div>
      )}
    </div>
  );
}
