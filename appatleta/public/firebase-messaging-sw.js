// public/firebase-messaging-sw.js

// 1. IMPORTACIÓN DE SCRIPTS (Usamos una versión reciente como en la sugerencia)
// Asegúrate de que esta versión sea compatible con la que usas en tu app.
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// 2. CONFIGURACIÓN DINÁMICA (Mantenemos la excelente práctica de tu archivo original)
const firebaseConfig = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  storageBucket: 'VITE_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'VITE_FIREBASE_APP_ID',
  measurementId: 'VITE_FIREBASE_MEASUREMENT_ID'
};

// Función para reemplazar placeholders con los valores reales (de tu script original)
const replaceConfigValues = (config) => {
  return Object.fromEntries(
    Object.entries(config).map(([key, value]) => [
      key,
      // 'self' es el scope global en un Service Worker
      self[value] || value
    ])
  );
};

// Inicialización de Firebase
const app = firebase.initializeApp(replaceConfigValues(firebaseConfig));
const messaging = firebase.messaging();

// 3. MANEJO DE MENSAJES EN SEGUNDO PLANO (Combinando ambos)
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Mensaje recibido en segundo plano:', payload);

  // Opciones de notificación enriquecidas (de la sugerencia)
  const notificationOptions = {
    body: payload.notification?.body || 'Tienes un nuevo mensaje',
    icon: payload.notification?.icon || '/logo192.png', // Usamos tu ícono original
    badge: '/badge.png', // Usamos tu badge original
    tag: payload.data?.tag || 'default-tag', // Etiqueta para agrupar notificaciones
    data: {
        // Mantenemos el deepLink de tu script original, es más específico
        deepLink: payload.data?.deepLink || '/', 
        ...payload.data 
    },
    // Acciones personalizadas para la notificación (de la sugerencia)
    actions: [
      { action: 'open_app', title: 'Abrir' },
      { action: 'dismiss', title: 'Descartar' }
    ],
    requireInteraction: true // Mantiene la notificación visible hasta que el usuario interactúe
  };

  // Mostrar la notificación
  return self.registration.showNotification(
    payload.notification?.title || 'Nuevo Recordatorio', // Título de tu script original
    notificationOptions
  );
});

// 4. MANEJO DE CLICS EN NOTIFICACIONES (Combinando ambos)
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Click en notificación:', event.action, event.notification.data);
  event.notification.close();

  // Si el usuario hace clic en "Descartar", no hacemos nada.
  if (event.action === 'dismiss') {
    return;
  }
  
  // Usamos tu lógica de deepLink para abrir la URL correcta.
  const targetUrl = new URL(event.notification.data?.deepLink || '/', self.location.origin).href;

  // Lógica para enfocar una ventana existente o abrir una nueva (mejorada)
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Buscar si ya hay una ventana abierta en la URL de destino
        for (const client of clientList) {
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus();
          }
        }
        // Si no hay una ventana abierta, abrir una nueva.
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});


// 5. GESTIÓN DEL CICLO DE VIDA Y ERRORES (Combinando ambos)
self.addEventListener('install', (event) => {
  self.skipWaiting();
  console.log('[SW] Service Worker instalado');
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
  console.log('[SW] Service Worker activado');
});

self.addEventListener('error', (event) => {
  console.error('[SW] Error en Service Worker:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[SW] Promise rechazada no manejada:', event.reason);
});