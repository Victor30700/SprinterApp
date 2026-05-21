// firebase-notifications.service.js - Servicio completo de notificaciones

import { getMessaging, getToken, deleteToken, onMessage } from 'firebase/messaging';
import { app } from '../config/firebase'; // Ajusta la ruta según tu estructura

// Inicializar Firebase Messaging
const messaging = getMessaging(app);

// Tu VAPID Key (obtener de Firebase Console > Project Settings > Cloud Messaging)
const VAPID_KEY = 'TU_VAPID_KEY_AQUI'; // Reemplaza con tu clave VAPID real

/**
 * Verifica si las notificaciones están soportadas en el navegador
 */
export const isNotificationSupported = () => {
  return 'Notification' in window && 'serviceWorker' in navigator;
};

/**
 * Obtiene el estado actual de los permisos de notificación
 */
export const getNotificationPermissionStatus = () => {
  if (!isNotificationSupported()) {
    return 'not-supported';
  }
  return Notification.permission; // 'default', 'granted', 'denied'
};

/**
 * Solicita permisos de notificación al usuario
 */
export const requestNotificationPermission = async () => {
  try {
    if (!isNotificationSupported()) {
      console.warn('Este navegador no soporta notificaciones');
      return null;
    }

    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      console.log('Permisos de notificación concedidos');
      return await getNotificationToken();
    } else {
      console.warn('Permisos de notificación denegados');
      return null;
    }
  } catch (error) {
    console.error('Error al solicitar permisos de notificación:', error);
    return null;
  }
};

/**
 * Obtiene el token de notificación FCM
 */
export const getNotificationToken = async () => {
  try {
    if (!isNotificationSupported()) {
      console.warn('Notificaciones no soportadas');
      return null;
    }

    if (Notification.permission !== 'granted') {
      console.warn('No hay permisos para obtener token de notificación');
      return null;
    }

    // Solo usar VAPID key si está configurada
    const tokenOptions = VAPID_KEY !== 'TU_VAPID_KEY_AQUI' ? { vapidKey: VAPID_KEY } : {};
    
    const token = await getToken(messaging, tokenOptions);
    
    if (token) {
      console.log('Token FCM obtenido:', token);
      return token;
    } else {
      console.warn('No se pudo obtener el token FCM');
      return null;
    }
  } catch (error) {
    console.error('Error al obtener token FCM:', error);
    
    // Manejo específico de errores comunes
    if (error.code === 'missing-app-config-values') {
      console.error('Configuración de Firebase incompleta. Verifica tu configuración.');
    } else if (error.code === 'messaging/permission-blocked') {
      console.warn('Permisos de notificación bloqueados por el usuario');
    }
    
    return null;
  }
};

/**
 * Elimina el token de notificación FCM
 */
export const clearNotificationToken = async () => {
  try {
    if (!isNotificationSupported()) {
      console.log('Notificaciones no soportadas - no hay token que eliminar');
      return;
    }

    // Solo intentar eliminar si tenemos permisos concedidos
    if (Notification.permission === 'granted') {
      await deleteToken(messaging);
      console.log('Token FCM eliminado correctamente');
    } else {
      console.log('No hay token FCM que eliminar - permisos no concedidos');
    }
  } catch (error) {
    console.error('Error al eliminar token FCM:', error);
    
    // No lanzar error para casos específicos
    if (error.code === 'messaging/permission-blocked' || 
        error.code === 'messaging/token-unsubscribe-failed') {
      console.warn('No se pudo eliminar el token, pero no es crítico:', error.message);
      return;
    }
    
    // Solo relanzar errores críticos
    throw error;
  }
};

/**
 * Configura el listener para mensajes en primer plano
 */
export const onForegroundMessage = (callback) => {
  try {
    if (!isNotificationSupported()) {
      console.warn('Notificaciones no soportadas - no se puede escuchar mensajes');
      return () => {}; // Retornar función vacía para cleanup
    }

    console.log('Configurando listener para mensajes en primer plano');
    
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('Mensaje recibido en primer plano:', payload);
      
      // Mostrar notificación personalizada si es necesario
      if (payload.notification) {
        showCustomNotification(payload.notification);
      }
      
      // Ejecutar callback personalizado
      if (typeof callback === 'function') {
        callback(payload);
      }
    });

    return unsubscribe;
  } catch (error) {
    console.error('Error configurando listener de mensajes:', error);
    return () => {}; // Retornar función vacía para cleanup
  }
};

/**
 * Muestra una notificación personalizada
 */
const showCustomNotification = (notificationData) => {
  try {
    if (Notification.permission === 'granted') {
      const notification = new Notification(notificationData.title || 'Nueva notificación', {
        body: notificationData.body || '',
        icon: notificationData.icon || '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'firebase-notification',
        requireInteraction: false,
        silent: false
      });

      // Auto cerrar después de 5 segundos
      setTimeout(() => {
        notification.close();
      }, 5000);

      // Manejar click en la notificación
      notification.onclick = () => {
        window.focus();
        notification.close();
        
        // Aquí puedes agregar lógica adicional para manejar el click
        if (notificationData.click_action) {
          window.open(notificationData.click_action, '_blank');
        }
      };
    }
  } catch (error) {
    console.error('Error mostrando notificación personalizada:', error);
  }
};

/**
 * Inicializa el servicio de notificaciones
 */
export const initializeNotificationService = async () => {
  try {
    console.log('Inicializando servicio de notificaciones...');
    
    if (!isNotificationSupported()) {
      console.warn('Notificaciones no soportadas en este navegador');
      return null;
    }

    const permissionStatus = getNotificationPermissionStatus();
    console.log('Estado actual de permisos:', permissionStatus);

    if (permissionStatus === 'granted') {
      const token = await getNotificationToken();
      if (token) {
        console.log('Servicio de notificaciones inicializado correctamente');
        return token;
      }
    }

    return null;
  } catch (error) {
    console.error('Error inicializando servicio de notificaciones:', error);
    return null;
  }
};

/**
 * Función helper para debugging
 */
export const debugNotificationService = () => {
  console.log('=== DEBUG NOTIFICATION SERVICE ===');
  console.log('Soporte de notificaciones:', isNotificationSupported());
  console.log('Estado de permisos:', getNotificationPermissionStatus());
  console.log('Firebase Messaging:', messaging);
  console.log('VAPID Key configurada:', VAPID_KEY !== 'TU_VAPID_KEY_AQUI');
  console.log('=====================================');
};