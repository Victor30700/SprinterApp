  //app/admin/users/UsersClient.jsx
'use client';

import { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import { useRouter } from 'next/navigation';

import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';

export default function UsersClient() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newSubscriptionDate, setNewSubscriptionDate] = useState(new Date());
  const [cantidadMeses, setCantidadMeses] = useState(1);
  const [showModal, setShowModal] = useState(false);

  const { data: usersData, error, isLoading, mutate } = useSWR('/api/users', fetcher, {
    refreshInterval: 5000,
  });

  useEffect(() => {
    if (!usersData) return;
    const term = searchTerm.toLowerCase();
    setFilteredUsers(
      usersData.filter(user =>
        user.fullName.toLowerCase().includes(term) || user.email.toLowerCase().includes(term)
      )
    );
  }, [searchTerm, usersData]);

  const handleUpdateSubscription = async () => {
    await fetch('/api/update-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: selectedUser.id,
        fechaSuscripcion: newSubscriptionDate,
        cantidadMeses,
      }),
    });
    mutate();
    setShowModal(false);
    Swal.fire('Actualizado', 'La suscripción ha sido actualizada correctamente.', 'success');
  };

  const handleToggleActive = async (userId) => {
    await fetch('/api/toggle-active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    mutate();
    Swal.fire('Estado actualizado', 'El estado del usuario ha sido cambiado.', 'success');
  };

  const handleClearSubscription = async (user) => {
    const result = await Swal.fire({
      title: `¿Borrar suscripción de ${user.fullName}?`,
      text: 'Esta acción eliminará la suscripción actual del usuario.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#eab308',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, borrar',
      cancelButtonText: 'Cancelar',
    });

    if (result.isConfirmed) {
      await fetch('/api/clear-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      mutate();
      Swal.fire('Suscripción eliminada', 'La suscripción ha sido eliminada correctamente.', 'success');
    }
  };

  if (isLoading) return <p>Cargando usuarios...</p>;
  if (error) return <p>Error al cargar usuarios.</p>;
    

    return (
      <div className="p-6 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 min-h-screen text-white">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Usuarios</h1>
          <button
            onClick={() => router.push('/admin/users/new')}
            className="bg-blue-600 hover:bg-blue-700 transition px-4 py-2 rounded shadow-lg"
          >
            + Nuevo Usuario
          </button>
        </div>

        <input
          type="text"
          placeholder="Buscar por nombre o correo..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full mb-4 p-2 rounded bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <div className="overflow-x-auto">
          <table className="min-w-full bg-gray-800 rounded shadow-lg">
            <thead>
              <tr className="bg-gray-700">
                <th className="py-3 px-4">Nombre</th>
                <th className="py-3 px-4">Edad</th>
                <th className="py-3 px-4">Correo</th>
                <th className="py-3 px-4">IsPremium</th>
                <th className="py-3 px-4">Activo</th>
                <th className="py-3 px-4">Tipo Corredor</th>
                <th className="py-3 px-4">Celular</th>
                <th className="py-3 px-4">Fecha Inicio</th>
                <th className="py-3 px-4">Fecha Fin</th>
                <th className="py-3 px-4">Sexo</th>
                <th className="py-3 px-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className="hover:bg-gray-700 transition"
                >
                  <td className="py-2 px-4">{user.fullName}</td>
                  <td className="py-2 px-4">{user.age}</td>
                  <td className="py-2 px-4">{user.email}</td>
                  <td className="py-2 px-4">{user.isPremium ? 'Sí' : 'No'}</td>
                  <td className="py-2 px-4">{user.active ? 'Sí' : 'No'}</td>
                  <td className="py-2 px-4">{user.tipoCorredor}</td>
                  <td className="py-2 px-4">{user.celular}</td>
                  <td className="py-2 px-4">{user.fechaSuscripcion}</td>
                  <td className="py-2 px-4">{user.fechaVencimiento}</td>
                  <td className="py-2 px-4">{user.sexo}</td>
                  <td className="py-2 px-4 space-x-2">
    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center' }}>
    <button
      className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded"
      
      onClick={() => {
        setSelectedUser(user);
        setNewSubscriptionDate(new Date());
        setCantidadMeses(1);
        setShowModal(true);
      }}
    >
      Actualizar
    </button>
    <button
      className={`${
        user.active ? 'bg-red-600' : 'bg-blue-600'
      } hover:scale-105 transform transition px-3 py-1 rounded`}
      onClick={() => handleToggleActive(user.id)}
    >
      {user.active ? 'Desactivar' : 'Activar'}
    </button>
    <button
      className="bg-yellow-600 hover:bg-yellow-700 px-1 py-1 rounded"
      onClick={() => handleClearSubscription(user)}
    >
      Borrar suscripción
    </button>
    </div>
  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {showModal && selectedUser && (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50">
      <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white p-6 rounded-2xl shadow-2xl w-[350px] transition-all duration-300 border border-gray-300 dark:border-gray-700">
        <h2 className="text-2xl font-extrabold text-center mb-6 tracking-wide">Actualizar Suscripción</h2>

        <label className="block text-sm font-semibold mb-1">Fecha de suscripción:</label>
        <DatePicker
          selected={newSubscriptionDate}
          onChange={(date) => setNewSubscriptionDate(date)}
          className="border border-gray-300 dark:border-gray-600 rounded-md p-2 w-full text-black dark:text-white bg-white dark:bg-gray-800"
          dateFormat="yyyy-MM-dd"
        />

        <label className="block mt-4 text-sm font-semibold mb-1">Meses a pagar:</label>
        <select
          value={cantidadMeses}
          onChange={(e) => setCantidadMeses(Number(e.target.value))}
          className="p-2 w-full border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-black dark:text-white"
        >
          {[...Array(12)].map((_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1} mes{(i + 1) > 1 ? 'es' : ''}
            </option>
          ))}
        </select>

        <div className="flex justify-end mt-6 space-x-3">
          <button
            className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold px-4 py-2 rounded-md shadow-md transition"
            onClick={handleUpdateSubscription}
          >
            Guardar
          </button>
          <button
            className="bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white font-bold px-4 py-2 rounded-md shadow-md transition"
            onClick={() => setShowModal(false)}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )}

      </div>
    );
  }
