// app/api/toggle-active/route.js
import { NextResponse } from 'next/server';
import { admin } from '@/lib/firebase-admin';

export async function POST(req) {
  try {
    const { userId } = await req.json();
    const userRef = admin.firestore().collection('users').doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) throw new Error('Usuario no encontrado');

    const current = userSnap.data().active || false;
    await userRef.update({ active: !current });

    return NextResponse.json({ message: `Usuario ${!current ? 'activado' : 'desactivado'}` });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

