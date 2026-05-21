import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import Swal from 'sweetalert2';
import '../styles/EditarPerfil.css';

export default function CrearUsuario() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    age: '',
    celular: '',
    sexo: '',
    tipoCorredor: '',
  });

  const navigate = useNavigate();
  const auth = getAuth();

  const handleChange = e => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCrear = async () => {
    const camposRequeridos = {
        fullName: 'Nombre completo',
        email: 'Correo',
        password: 'Contraseña',
        age: 'Edad',
        celular: 'Celular',
        sexo: 'Sexo',
        tipoCorredor: 'Tipo de corredor',
      };
      
      const faltantes = Object.entries(camposRequeridos)
        .filter(([key]) => !formData[key] || formData[key].trim() === '')
        .map(([, label]) => label);
      
      if (faltantes.length > 0) {
        await Swal.fire({
          icon: 'warning',
          title: 'Campos faltantes',
          html: `Falta completar:<br><strong>${faltantes.join(', ')}</strong>`,
          confirmButtonText: 'Entendido',
        });
        return;
      }
      

    if (faltantes.length > 0) {
      await Swal.fire({
        icon: 'warning',
        title: 'Campos obligatorios faltantes',
        html: `Faltan:<br><strong>${faltantes.join(', ')}</strong>`,
        confirmButtonText: 'Ok',
      });
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      const user = userCredential.user;

      await setDoc(doc(db, 'users', user.uid), {
        ...formData,
        active: false,
        isPremium: false,
        fechaSuscripcion: '-',
        fechaVencimiento: '-',
        createdAt: new Date(),
        mesesSuscrito: '0',
      });

      await auth.signOut();

    //   await Swal.fire({
    //     icon: 'success',
    //     title: 'Usuario creado',
    //     text: 'Cuenta registrada correctamente. Ahora inicia sesión con tus datos.',
    //   });
      
      // Cerrar sesión para no mantener al usuario activo
      
      
      navigate('/login');
      
    } catch (error) {
      console.error('Error creando usuario:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo crear el usuario.',
      });
    }
  };

  const handleCancelar = () => {
    navigate('/home');
  };

  return (
    <div className="perfil-container">
      <div className="perfil-card">
        <h2>Crear Usuario</h2>
        <form>
          <label>Nombre completo</label>
          <input
            type="text"
            name="fullName"
            value={formData.fullName}
            onChange={handleChange}
          />

          <label>Correo</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
          />

          <label>Contraseña</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
          />

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

          <label>Sexo</label>
          <select
            name="sexo"
            value={formData.sexo}
            onChange={handleChange}
            className="w-full p-3 rounded border border-gray-300 bg-white text-black"
          >
            <option value="">Seleccionar</option>
            <option value="Hombre">Hombre</option>
            <option value="Mujer">Mujer</option>
        </select>

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
            <button type="button" onClick={handleCrear}>
              Crear
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
