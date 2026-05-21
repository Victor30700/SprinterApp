//lib/firebase-admin.js
import admin from 'firebase-admin';

// Verificar si la app ya está inicializada para evitar errores en desarrollo con hot reload
if (!admin.apps.length) {
  try {
    console.log('Inicializando Firebase Admin...');
    
    // Limpiar la clave privada
    const privateKey = process.env.FIREBASE_PRIVATE_KEY 
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') 
      : undefined;
    
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      })
      // No necesitamos databaseURL a menos que usemos Realtime Database
    });
    
    console.log('Firebase Admin inicializado correctamente');
  } catch (error) {
    console.error('Error al inicializar Firebase Admin:', error);
    throw new Error('Error al inicializar Firebase Admin');
  }
}

export const db = admin.firestore();
export const auth = admin.auth();
export const messaging = admin.messaging();
export default admin;