// scripts/check-indexes.js
// Este script debe ejecutarse desde la línea de comandos: node scripts/check-indexes.js

require('dotenv').config();
const admin = require('firebase-admin');

// Configuración del SDK de Firebase Admin
const privateKey = process.env.FIREBASE_PRIVATE_KEY 
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') 
  : undefined;

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: privateKey,
  })
});

const db = admin.firestore();

async function checkAndCreateIndexes() {
  console.log('Verificando índices necesarios para la aplicación...');
  
  try {
    // Obtener todos los usuarios
    const usersSnapshot = await db.collection('userEvents').get();
    
    // Array de promesas para verificar cada colección de eventos
    const checkPromises = usersSnapshot.docs.map(async (userDoc) => {
      const userId = userDoc.id;
      console.log(`Verificando usuario: ${userId}`);
      
      try {
        // Intenta ejecutar la consulta para verificar si los índices existen
        await db.collection('userEvents')
          .doc(userId)
          .collection('events')
          .where('date', '>=', admin.firestore.Timestamp.fromDate(new Date()))
          .orderBy('date')
          .limit(1)
          .get();
        
        console.log(`✅ Índice OK para usuario ${userId}`);
        return true;
      } catch (error) {
        if (error.code === 9) {
          console.error(`❌ Índice faltante para usuario ${userId}`);
          console.error('Error:', error.message);
          console.error('Se requiere crear un índice compuesto. Puedes hacerlo desde la consola de Firebase.');
          console.error('URL sugerida para crear índice:', error.message.match(/https:\/\/console\.firebase\.google\.com\/.*[?&]index=.*/)?.[0] || 'No disponible');
          return false;
        } else {
          console.error(`Error desconocido para usuario ${userId}:`, error);
          return false;
        }
      }
    });
    
    const results = await Promise.all(checkPromises);
    const allIndexesOk = results.every(result => result === true);
    
    if (allIndexesOk) {
      console.log('✅ Todos los índices están correctamente configurados');
    } else {
      console.error('❌ Algunos índices están faltantes. Por favor, crea los índices siguiendo los enlaces proporcionados.');
      console.log('También puedes crear los índices desde la consola de Firebase: https://console.firebase.google.com/project/' + process.env.FIREBASE_PROJECT_ID + '/firestore/indexes');
    }
  } catch (error) {
    console.error('Error al verificar índices:', error);
  }
  
  // Salir del proceso
  process.exit();
}

// Ejecutar la función principal
checkAndCreateIndexes();