import { messaging } from '../config/firebase';
import { getToken, onMessage, deleteToken } from 'firebase/messaging';
import { db } from '../config/firebase';
import { doc, setDoc, arrayUnion } from 'firebase/firestore';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

let swRegistration = null;

const getSWRegistration = async () => {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Workers no soportados');
    return null;
  }
  
  try {
    swRegistration = swRegistration || await navigator.serviceWorker.register(
      '/firebase-messaging-sw.js',
      { scope: '/firebase-cloud-messaging-push-scope' }
    );
    return swRegistration;
  } catch (error) {
    console.error('Error registrando Service Worker:', error);
    return null;
  }
};

export const requestNotificationPermission = async (user) => {
  try {
    if (!user?.uid) {
      console.warn('Usuario no autenticado');
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const registration = await getSWRegistration();
    if (!registration) return null;

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration
    });

    if (token) {
      await setDoc(doc(db, 'users', user.uid), {
        fcmTokens: arrayUnion(token)
      }, { merge: true });
      console.log('Token almacenado para:', user.uid);
    }

    return token;
  } catch (error) {
    console.error('Error en solicitud de notificaciones:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    return null;
  }
};

export const clearNotificationToken = async () => {
  try {
    const token = await getToken(messaging);
    if (token) {
      await deleteToken(messaging);
      console.log('Token eliminado');
    }
  } catch (error) {
    console.error('Error eliminando token:', error);
  }
};

export const onMessageListener = (callback) => {
  return onMessage(messaging, (payload) => {
    console.log('Mensaje en primer plano:', payload);
    callback(payload);
  });
};