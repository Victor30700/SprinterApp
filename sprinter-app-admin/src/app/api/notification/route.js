// src/app/api/notification/send/route.js
import { NextResponse } from 'next/server';
import { db, messaging } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST(request) {
  try {
    // Verificar autorización
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    console.log("Iniciando proceso de notificaciones...");

    // Obtener la fecha actual con zona horaria ajustada
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    console.log(`Fecha actual: ${today.toISOString()}`);

    // Primero, creamos índices compuestos manualmente para esta consulta
    // Para hacer esto de manera correcta, necesitamos listar todas las colecciones 'events' primero
    const usersSnapshot = await db.collection('userEvents').get();
    const notificationsSent = [];
    let totalNotificationsSent = 0;

    // Procesar cada usuario por separado en lugar de usar collectionGroup
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      console.log(`Procesando eventos para usuario: ${userId}`);
      
      // Consultar eventos para este usuario específico
      const eventsSnapshot = await db.collection('userEvents')
        .doc(userId)
        .collection('events')
        .where('date', '>=', Timestamp.fromDate(today))
        .orderBy('date')
        .get();
      
      console.log(`Encontrados ${eventsSnapshot.size} eventos para usuario ${userId}`);
      
      if (!eventsSnapshot.empty) {
        // Procesar eventos para este usuario
        const batch = db.batch();
        
        for (const eventDoc of eventsSnapshot.docs) {
          const eventData = eventDoc.data();
          const eventDate = eventData.date.toDate();
          
          // Ajustar fechas a medianoche para comparación
          const eventDay = new Date(eventDate);
          eventDay.setHours(0, 0, 0, 0);
          
          const advanceDate = new Date(eventDay);
          advanceDate.setDate(eventDay.getDate() - eventData.advanceDays);

          const isAdvanceDay = advanceDate.getTime() === today.getTime();
          const isExactDay = eventDay.getTime() === today.getTime();
          
          const updates = {};
          let sendNotification = false;
          let notificationTitle = '';

          // Notificación de aviso previo
          if (isAdvanceDay && !eventData.advanceNotificationSent) {
            updates.advanceNotificationSent = true;
            sendNotification = true;
            notificationTitle = `⏰ Recordatorio: ${eventData.title}`;
            console.log(`Enviando notificación de aviso previo para evento: ${eventData.title}`);
          }
          
          // Notificación del día exacto
          if (isExactDay && !eventData.exactNotificationSent) {
            updates.exactNotificationSent = true;
            sendNotification = true;
            notificationTitle = `🎉 Evento Hoy: ${eventData.title}`;
            console.log(`Enviando notificación de día exacto para evento: ${eventData.title}`);
          }

          if (sendNotification) {
            try {
              // Verificar si existe el documento del usuario
              const userDataDoc = await db.collection('users').doc(userId).get();
              
              if (userDataDoc.exists) {
                const userData = userDataDoc.data();
                const tokens = userData?.fcmTokens || [];
                
                if (tokens.length > 0) {
                  console.log(`Encontrados ${tokens.length} tokens para usuario ${userId}`);
                  
                  for (const token of tokens) {
                    try {
                      await messaging.send({
                        token,
                        notification: {
                          title: notificationTitle,
                          body: eventData.message || 'No hay mensaje adicional'
                        }
                      });
                      
                      totalNotificationsSent++;
                      notificationsSent.push({
                        userId,
                        eventId: eventDoc.id,
                        title: notificationTitle
                      });
                      
                      console.log(`Notificación enviada exitosamente a token: ${token.substring(0, 10)}...`);
                    } catch (tokenError) {
                      console.error(`Error enviando a token ${token.substring(0, 10)}...: ${tokenError.message}`);
                      
                      // Si el token es inválido, podríamos eliminarlo
                      if (tokenError.code === 'messaging/invalid-registration-token' ||
                          tokenError.code === 'messaging/registration-token-not-registered') {
                        console.log(`Eliminando token inválido: ${token.substring(0, 10)}...`);
                        // Aquí iría el código para eliminar el token inválido
                      }
                    }
                  }
                } else {
                  console.log(`No hay tokens FCM para usuario ${userId}`);
                }
              } else {
                console.log(`No existe documento para usuario ${userId} en colección 'users'`);
              }
            } catch (userError) {
              console.error(`Error al procesar usuario ${userId}: ${userError.message}`);
            }
            
            // Actualizar el documento del evento con los flags de notificación
            batch.update(eventDoc.ref, updates);
          }
        }
        
        // Commit de todas las actualizaciones para este usuario
        await batch.commit();
        console.log(`Actualizaciones de batch completadas para usuario ${userId}`);
      }
    }

    console.log(`Proceso finalizado. Total notificaciones enviadas: ${totalNotificationsSent}`);
    
    return NextResponse.json({
      success: true,
      notificationsSent: totalNotificationsSent,
      details: notificationsSent
    });

  } catch (error) {
    console.error("Error en la API de notificaciones:", error);
    return NextResponse.json(
      { error: "Error interno del servidor", details: error.message },
      { status: 500 }
    );
  }
}