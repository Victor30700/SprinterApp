import React from 'react';
import ReactDOM from 'react-dom/client';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './config/firebase';
import { AuthProvider } from './context/AuthContext';
import App from './App';
import {
  onForegroundMessage,
  clearNotificationToken,
  initializeNotificationService,
  debugNotificationService
} from './services/firebase-notifications.service.js';

// Variable para almacenar el unsubscribe de mensajes
let messageUnsubscribe = null;

// Configuración de mensajes en primer plano
const setupForegroundMessages = () => {
  messageUnsubscribe = onForegroundMessage((payload) => {
    const { title, body } = payload.notification || {};
    if (title && body) {
      new Notification(title, {
        body,
        icon: '/logo192.png'
      });
    }
    if (payload.data) {
      console.log('Datos adicionales:', payload.data);
    }
  });
};

// Manejo de autenticación y tokens
const handleAuthStateChange = async (user) => {
  try {
    if (user) {
      console.log('✅ Usuario autenticado:', user.uid);
      
      const token = await initializeNotificationService();
      if (token) {
        console.log('🔔 Token de notificación obtenido');
        setupForegroundMessages();
        // await sendTokenToBackend(token, user.uid); // Descomenta si es necesario
      }
    } else {
      console.log('❌ Usuario desautenticado');
      await clearNotificationToken();
      if (messageUnsubscribe) {
        messageUnsubscribe();
        messageUnsubscribe = null;
      }
    }
  } catch (error) {
    console.error('❌ Error en flujo de autenticación:', error);
    if (messageUnsubscribe) {
      messageUnsubscribe();
      messageUnsubscribe = null;
    }
  }
};

// Función opcional para enviar token al backend
const sendTokenToBackend = async (token, userId) => {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_BACKEND_URL}/api/v1/notification-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
      },
      body: JSON.stringify({
        token,
        userId,
        platform: 'web'
      })
    });
    
    if (response.ok) {
      console.log('✅ Token enviado al backend correctamente');
    } else {
      console.warn('⚠️ Error enviando token al backend:', response.status);
    }
  } catch (error) {
    console.error('❌ Error enviando token al backend:', error);
  }
};

// Inicialización de la app
const initializeApp = () => {
  if (import.meta.env.DEV) {
    debugNotificationService();
  }

  const authUnsubscribe = onAuthStateChanged(auth, handleAuthStateChange);

  // Limpieza al recargar
  window.addEventListener('beforeunload', () => {
    authUnsubscribe();
    if (messageUnsubscribe) {
      messageUnsubscribe();
    }
  });

  // Renderizar la aplicación React
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
    </React.StrictMode>
  );
};

// Iniciar aplicación
initializeApp();