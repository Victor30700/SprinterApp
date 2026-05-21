// app/api/create-user/route.js
import { NextResponse } from 'next/server';
import { admin } from '@/lib/firebase-admin';

export async function POST(req) {
  try {
    const body = await req.json();

    const {
      fullName,
      age,
      email,
      tipoCorredor,
      celular,
      fechaSuscripcion,
      fechaVencimiento,
      //mesesSuscrito,
      sexo,
    } = body;

    const password = 'password';

    // Crear usuario en Firebase Auth
    const userRecord = await admin.auth().createUser({
      email,
      password,
    });

    // Guardar datos extra en Firestore
    await admin.firestore().collection('users').doc(userRecord.uid).set({
      fullName,
      age,
      email,
      tipoCorredor,
      celular,
      fechaSuscripcion,
      fechaVencimiento,
      //mesesSuscrito,
      sexo,
      password, // para control administrativo
      isPremium: false,
      active: true,
      createdAt: new Date(),
    });

    return NextResponse.json({ message: 'Usuario creado correctamente' }, { status: 201 });
  } catch (error) {
    console.error('Error creando usuario:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
