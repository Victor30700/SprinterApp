'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase-client';
import { addDoc, collection, getFirestore } from 'firebase/firestore';
import Swal from 'sweetalert2';


export default function NewUserPage() {
  const [formData, setFormData] = useState({
    fullName: '',
    age: '',
    email: '',
    tipoCorredor: '',
    celular: '',
    fechaSuscripcion: '-',
    fechaVencimiento: '-',
    //mesesSuscrito: '0',
    sexo: '',
  });
  const router = useRouter();
  const db = getFirestore();

  const handleChange = e => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
  
    const camposFaltantes = Object.entries(formData)
      .filter(([key, value]) => value.trim() === '')
      .map(([key]) => {
        const nombres = {
          fullName: 'Nombre completo',
          age: 'Edad',
          email: 'Correo electrónico',
          tipoCorredor: 'Tipo de corredor',
          celular: 'Celular',
          sexo: 'Sexo',
        };
        return nombres[key] || key;
      });
  
    if (camposFaltantes.length > 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos incompletos',
        text:
          camposFaltantes.length === 1
            ? `Falta el campo: ${camposFaltantes[0]}`
            : `Faltan los campos: ${camposFaltantes.join(', ')}`,
        confirmButtonColor: '#3b82f6',
      });
      return;
    }
  
    try {
      const res = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
  
      const result = await res.json();
  
      if (res.ok) {
        Swal.fire({
          icon: 'success',
          title: 'Usuario creado',
          text: 'El usuario fue registrado correctamente.',
          showConfirmButton: false,
          timer: 1500,
        });
        setTimeout(() => router.push('/admin/users'), 1500);
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: result.error || 'Error al crear el usuario.',
        });
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Error de red',
        text: 'No se pudo conectar con el servidor.',
      });
    }
  };  

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-white to-gray-200 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-10 px-4">
      <div className="max-w-4xl mx-auto bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-xl shadow-lg p-10">
        <h1 className="text-3xl font-bold text-center mb-8">Agregar Usuario</h1>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block mb-1 font-semibold">Nombre completo</label>
            <input
              type="text"
              name="fullName"
              placeholder="Ej: Juan Pérez"
              value={formData.fullName}
              onChange={handleChange}
              className="w-full p-3 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
              
            />
          </div>
          <div>
            <label className="block mb-1 font-semibold">Edad</label>
            <input
              type="number"
              name="age"
              placeholder="Ej: 25"
              value={formData.age}
              onChange={handleChange}
              className="w-full p-3 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
              
            />
          </div>
          <div>
            <label className="block mb-1 font-semibold">Correo electrónico</label>
            <input
              type="email"
              name="email"
              placeholder="Ej: usuario@correo.com"
              value={formData.email}
              onChange={handleChange}
              className="w-full p-3 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
              
            />
          </div>
          <div>
            <label className="block mb-1 font-semibold">Tipo de corredor</label>
            <select
              name="tipoCorredor"
              value={formData.tipoCorredor}
              onChange={handleChange}
              className="w-full p-3 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-black dark:text-white"
              
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
          </div>
          <div>
            <label className="block mb-1 font-semibold">Celular</label>
            <input
              type="text"
              name="celular"
              placeholder="Ej: 5512345678"
              value={formData.celular}
              onChange={handleChange}
              className="w-full p-3 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
              
            />
          </div>
          <div>
            <label className="block mb-1 font-semibold">Sexo</label>
            <select
              name="sexo"
              value={formData.sexo}
              onChange={handleChange}
              className="w-full p-3 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-black dark:text-white"
              
            >
              <option value="">Seleccionar</option>
              <option value="hombre">Hombre</option>
              <option value="mujer">Mujer</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block mb-1 font-semibold text-gray-500">Contraseña (fija)</label>
            <input
              type="text"
              value="password"
              disabled
              className="w-full p-3 rounded bg-gray-100 text-gray-500 dark:bg-gray-700"
            />
          </div>
          <div className="sm:col-span-2 flex justify-end gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="bg-gray-500 hover:bg-gray-600 transition text-white font-semibold py-3 px-6 rounded shadow-md"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 transition text-white font-semibold py-3 px-6 rounded shadow-md"
            >
              Crear Usuario
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
