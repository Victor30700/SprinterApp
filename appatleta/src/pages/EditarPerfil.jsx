import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, updatePassword } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import '../styles/EditarPerfil.css';
import Swal from 'sweetalert2';

export default function EditarPerfil() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    age: '',
    celular: '',
    password: '',
    sexo: '',
    tipoCorredor: '',
  });

  const navigate = useNavigate();
  const auth = getAuth();
  const user = auth.currentUser;

  useEffect(() => {
    const fetchUser = async () => {
      if (user) {
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setFormData({
            fullName: data.fullName || '',
            email: data.email || '',
            age: data.age || '',
            celular: data.celular || '',
            password: data.password || '',
            sexo: data.sexo || '',
            tipoCorredor: data.tipoCorredor || '',
          });
        }
      }
    };

    fetchUser();
  }, [user]);

  const handleChange = e => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleGuardar = async () => {
    try {
      // Validar campos vacíos
      const camposObligatorios = {
        fullName: 'Nombre completo',
        age: 'Edad',
        celular: 'Celular',
        password: 'Contraseña',
        sexo: 'Sexo',
        tipoCorredor: 'Tipo de Corredor',
      };
  
      const camposFaltantes = Object.entries(camposObligatorios)
        .filter(([key]) => !formData[key])
        .map(([, label]) => label);
  
      if (camposFaltantes.length > 0) {
        await Swal.fire({
          icon: 'warning',
          title: 'Campos incompletos',
          html: `Faltan los siguientes campos:<br><strong>${camposFaltantes.join(', ')}</strong>`,
          confirmButtonText: 'Entendido',
        });
        return;
      }
  
      // Actualizar contraseña real
      if (user && formData.password) {
        await updatePassword(user, formData.password);
      }
  
      // Actualizar datos en Firestore
      const ref = doc(db, 'users', user.uid);
      await updateDoc(ref, {
        fullName: formData.fullName,
        age: formData.age,
        celular: formData.celular,
        password: formData.password,
        sexo: formData.sexo,
        tipoCorredor: formData.tipoCorredor,
      });
  
      await Swal.fire({
        icon: 'success',
        title: 'Perfil actualizado',
        text: 'Tus datos se guardaron correctamente.',
      });
  
      navigate('/home');
    } catch (error) {
      console.error('Error al actualizar datos o contraseña:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Hubo un problema al actualizar. Intenta de nuevo.',
      });
    }
  };
  
  

  const handleCancelar = () => {
    navigate('/home');
  };

  return (
    <div className="perfil-container">
      <div className="perfil-card">
        <h2>Editar Perfil</h2>
        <form>
          <label>Nombre completo</label>
          <input
            type="text"
            name="fullName"
            value={formData.fullName}
            onChange={handleChange}
          />

          <label>Correo (no editable)</label>
          <input type="email" value={formData.email} disabled />

          <label>Edad</label>
          <input
            type="text"
            name="age"
            value={formData.age}
            onChange={handleChange}
          />

          <label>Celular</label>
          <input
            type="text"
            name="celular"
            value={formData.celular}
            onChange={handleChange}
          />

          <label>Contraseña</label>
          <input
            type="text"
            name="password"
            value={formData.password}
            onChange={handleChange}
          />

          <label>Sexo</label>
          <input
            type="text"
            name="sexo"
            value={formData.sexo}
            onChange={handleChange}
          />

<label className="block mb-1 font-semibold">Tipo de corredor</label>
<select
  name="tipoCorredor"
  value={formData.tipoCorredor}
  onChange={handleChange}
  className="w-full p-3 rounded border border-gray-300 bg-white text-black"
>
  <option value="">Seleccionar</option>
  <option value="Velocista">Velocista</option>
  <option value="Corredor de media distancia">Corredor de media distancia</option>
  <option value="Fondista">Fondista</option>
  <option value="Corredor de vallas">Corredor de vallas</option>
  <option value="Corredor de relevos">Corredor de relevos</option>
  <option value="Salto de longitud">Salto de longitud</option>
  <option value="Salto triple">Salto triple</option>
  <option value="Salto de altura">Salto de altura</option>
  <option value="Salto con pértiga">Salto con pértiga</option>
  <option value="Corredor Novato">Corredor Novato</option>
</select>


          <div className="perfil-buttons">
            <button type="button" onClick={handleGuardar}>
              Guardar
            </button>
            <button type="button" className="cancelar" onClick={handleCancelar}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
