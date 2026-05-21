import { db } from '@/lib/firebase-admin';

function formatDate(field) {
  if (field?.toDate) {
    return field.toDate().toISOString().split('T')[0];
  }
  if (typeof field === 'string') {
    return field;
  }
  return '';
}

export async function GET() {
  const snapshot = await db.collection('users').get();

  const users = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    fechaSuscripcion: formatDate(doc.data().fechaSuscripcion),
    fechaVencimiento: formatDate(doc.data().fechaVencimiento),
  }));

  return Response.json(users);
}
