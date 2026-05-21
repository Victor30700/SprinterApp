import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { VideoProvider } from '../context/VideoContext'; // Importación correcta

// Páginas
import Login from '../pages/Login';
import Home from '../pages/Home';
import Partidas from '../pages/Partidas';
import RegistroEntrenamiento from '../pages/RegistroEntrenamiento';
import GraficaRendimiento from '../pages/GraficaRendimiento';
import ControlesPB from '../pages/ControlesPB';
import RegistroForm from '../pages/RegistroForm';
import LoadingScreen from '../components/LoadingScreen';
import ChatGPTPage from '../pages/ChatGPTPage';

// Nuevas páginas para Registro de Gym
import RegistroGymList from '../pages/RegistroGymList';
import RegistroGymForm from '../pages/RegistroGymForm';
import RegistroGymDiario from '../pages/RegistroGymDiario';

import EditarPerfil from '../pages/EditarPerfil';

// Componentes
import PrivatePremiumRoute from '../components/PrivatePremiumRoute';

// Otras Páginas
import CrearUsuario from '../pages/CrearUsuario';
import RegistroLesion from '../pages/RegistroLesion';
import RegistroPesoCorporal from '../pages/RegistroPesoCorporal';
import HealthProfilePage from '../pages/HealthProfilePage';
import RegistroEventos from '../pages/RegistroEventos';
import CalendarioEventos from '../pages/CalendarioEventos';

// **Nuevas páginas de videos**
import MyVideos from '../pages/MyVideos';
import VideoUpload from '../pages/VideoUpload';
import VideoAnalysis from '../pages/VideoAnalysis';

export default function AppRouter() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  return (
    // El cambio clave está aquí: Se envuelve el Router con VideoProvider
    <VideoProvider>
      <BrowserRouter>
        <Routes>
          {/* Ruta raíz */}
          <Route
            path="/"
            element={
              user
                ? <Navigate to="/home" replace />
                : <Navigate to="/login" replace />
            }
          />

          {/* Auth */}
          <Route
            path="/login"
            element={!user ? <Login /> : <Navigate to="/home" replace />}
          />
          <Route // Ruta para crear usuario debería ser accesible sin estar logueado
            path="/crear-usuario"
            element={!user ? <CrearUsuario /> : <Navigate to="/home" replace />}
          />

          {/* Rutas Privadas (requieren autenticación) */}
          
          <Route
            path="/home"
            element={user ? <Home /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/partidas"
            element={user ? <Partidas /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/registro"
            element={user ? <RegistroEntrenamiento /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/registro/nuevo"
            element={user ? <RegistroForm /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/grafica"
            element={user ? <GraficaRendimiento /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/controles"
            element={user ? <ControlesPB /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/editar-usuario"
            element={user ? <EditarPerfil /> : <Navigate to="/login" replace />}
          />

          {/* Rutas para registro de gym */}
          <Route
            path="/registro-gym"
            element={user ? <RegistroGymList /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/registro-gym/nuevo"
            element={user ? <RegistroGymForm /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/registro-gym/editar/:id" // Es común pasar un ID para editar
            element={user ? <RegistroGymForm /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/registro-gym/diario"
            element={user ? <RegistroGymDiario /> : <Navigate to="/login" replace />}
          />

          {/* Perfil de Salud */}
          <Route
            path="/health-profile"
            element={user ? <HealthProfilePage /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/health-profile/peso-altura"
            element={user ? <RegistroPesoCorporal /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/health-profile/lesiones"
            element={user ? <RegistroLesion /> : <Navigate to="/login" replace />}
          />

          {/* Chat GPT (Ruta Premium) */}
          <Route
            path="/chat"
            element={
              user ? (
                <PrivatePremiumRoute>
                  <ChatGPTPage />
                </PrivatePremiumRoute>
              ) : (
                <Navigate to="/login" replace /> // Redirigir a login si no hay usuario
              )
            }
          />

          {/* Calendario y Registro de Eventos */}
          <Route
            path="/calendario-eventos"
            element={user ? <CalendarioEventos /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/registro-eventos/:id?" // id opcional para crear o editar
            element={user ? <RegistroEventos /> : <Navigate to="/login" replace />}
          />

          {/* **Nuevas rutas para Videos** (Ahora funcionarán correctamente) */}
          <Route
              path="/my-videos"
              element={user ? <MyVideos /> : <Navigate to="/login" replace />}
          />
          <Route
              path="/video-upload"
              element={user ? <VideoUpload /> : <Navigate to="/login" replace />}
          />
          <Route
              path="/video-analysis/:videoId"
              element={user ? <VideoAnalysis /> : <Navigate to="/login" replace />}
          />

          {/* Fallback: Si ninguna ruta coincide, redirige */}
          <Route 
            path="*" 
            element={user ? <Navigate to="/home" replace /> : <Navigate to="/login" replace />} 
          />
        </Routes>
      </BrowserRouter>
    </VideoProvider>
  );
}