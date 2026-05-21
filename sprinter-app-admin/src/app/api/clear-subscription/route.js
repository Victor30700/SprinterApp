import { NextResponse } from 'next/server';
import { admin } from '@/lib/firebase-admin';

export async function POST(req) {
  try {
    const { userId } = await req.json();

    const userRef = admin.firestore().collection('users').doc(userId);
    await userRef.update({
      fechaSuscripcion: '-',
      fechaVencimiento: '-',
      isPremium: false,
    });

    return NextResponse.json({ message: 'Suscripción eliminada' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
