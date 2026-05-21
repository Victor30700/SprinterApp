// pages/api/login.js
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase-client';

export default async function handler(req, res) {
  const { email, password } = req.body;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const token = await userCredential.user.getIdToken();

    // Establecer la cookie en la respuesta del servidor
    res.setHeader('Set-Cookie', `auth_token=${token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Strict; Secure`);

    res.status(200).json({ message: 'Inicio de sesión exitoso' });
  } catch (error) {
    res.status(401).json({ error: 'Credenciales inválidas' });
  }
}
