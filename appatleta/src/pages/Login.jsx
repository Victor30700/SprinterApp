import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import Swal from 'sweetalert2';
import '../styles/Login.css';
import { FiMail, FiLock } from 'react-icons/fi';
import { Link } from 'react-router-dom';

const auth = getAuth();

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  //const [enRango, setEnRango] = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userRef = doc(db, 'users', user.uid);
      const userSnapshot = await getDoc(userRef);

      if (!userSnapshot.exists()) {
        throw new Error('Usuario no encontrado en Firestore');
      }

      const userData = userSnapshot.data();

      // 🔐 Verificar si la cuenta está activa
      if (!userData.active) {
        await signOut(auth);
        await Swal.fire({
          icon: 'error',
          title: `${userData.fullName}, tu cuenta está desactivada`,
          html: `
            <p>Para activarla, contacta al administrador:</p>
            <a href="https://wa.me/59167679528" target="_blank" style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 12px; font-size: 1.1rem; color: #25D366; text-decoration: none;">
              <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" width="24" height="24" alt="WhatsApp" />
              +591 67679528
            </a>
          `,
          confirmButtonText: 'Entendido',
        });
        
        return;
      }
      
      let enRango = false;

if (
  userData.fechaSuscripcion === '-' ||
  userData.fechaVencimiento === '-' ||
  !userData.fechaSuscripcion ||
  !userData.fechaVencimiento
) {
  enRango = false;
} else {
  const hoy = new Date();
  const fechaInicio = userData.fechaSuscripcion.toDate();
  const fechaFin = userData.fechaVencimiento.toDate();
  enRango = hoy >= fechaInicio && hoy <= fechaFin;
}

if (enRango && userData.isPremium === false) {
  console.log('------- ACTIVANDO PREMIUM ---------');
  await updateDoc(userRef, { isPremium: true });
} else if (!enRango && userData.isPremium === true) {
  console.log('------- DESACTIVANDO PREMIUM ---------');
  await updateDoc(userRef, { isPremium: false });
}


      // 🚀 Redirigir si todo OK
      navigate('/');
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'Error al iniciar sesión',
        text: 'Correo o contraseña incorrectos.',
      });
      console.error('Error de login:', error);
    }
  };

  return (
    <div className="login-container">
      {[...Array(8)].map((_, i) => (
        <div className="track-lane" key={i}>
          <span className="track-lane-number">{i + 1}</span>
        </div>
      ))}
      <div className="login-card">
        <h1 className="login-title">SprinterApp</h1>
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <FiMail className="login-icon" />
            <input
              type="email"
              placeholder="Correo electrónico"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{color: 'black'}}
            />
          </div>
          <div className="login-field">
            <FiLock className="login-icon" />
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{color: 'black'}}
            />
          </div>
          <button type="submit" className="login-button">
            Iniciar sesión
          </button>
          <p className="crear-cuenta-link">
  ¿No tienes cuenta? <Link to="/crear-usuario">Regístrate aquí</Link>
</p>
        </form>
      </div>
    </div>
  );
}
