// pages/api/login.js
import { serialize } from 'cookie';
import Cookies from 'js-cookie';

export default async function handler(req, res) {
  const { email, password } = req.body;

  // Lógica de autenticación (verifica las credenciales del usuario)
  const user = await authenticateUser(email, password);

  if (user) {
    // Generar un token de autenticación (puede ser un JWT o cualquier identificador)
    const token = generateAuthToken(user);

    // Establecer la cookie
    Cookies.set('__session', tokenResult.token, {
      path: '/',
      secure: true,
      sameSite: 'Strict',
      expires: 7 // La cookie expirará en 7 días
    });

    res.status(200).json({ message: 'Inicio de sesión exitoso' });
  } else {
    res.status(401).json({ message: 'Credenciales inválidas' });
  }
}
