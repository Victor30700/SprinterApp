// src/pages/Home.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Home.css';
import { GiFinishLine, GiNotebook, GiStopwatch, GiWeightLiftingUp, GiCalendar } from 'react-icons/gi'; // GiArchiveRegister no se usa, se podría quitar si no se va a usar.
import backgroundImage from '../assets/pista5.jpg';
import { BiBrain } from 'react-icons/bi';
import { FaHeartbeat, FaVideo } from 'react-icons/fa'; // Unificado el import de FaHeartbeat y FaVideo
import { MdTrendingUp } from 'react-icons/md';

import Navbar from '../components/NavBar';
import StatusModal from '../components/StatusModal';

import { getAuth } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import Swal from 'sweetalert2';

export default function Home() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Estado para el loader general de navegación

  const auth = getAuth();
  const user = auth.currentUser;

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
    }
  };

  const navigateWithLoading = (path) => {
    setIsLoading(true);
    // Un pequeño retraso para permitir que el modal de carga se muestre antes de la navegación.
    const navigationTimeout = setTimeout(() => {
      navigate(path);
      // Considera quitar setIsLoading(false) aquí.
      // Es mejor que el componente destino maneje su propio estado de carga
      // o que isLoading se resetee en un useEffect que dependa de la ruta.
    }, 600); // Ajusta el tiempo según sea necesario

    // Limpieza en caso de que el componente se desmonte o el usuario navegue manualmente
    const stopLoading = () => {
      clearTimeout(navigationTimeout);
      setIsLoading(false);
      window.removeEventListener('popstate', stopLoading); // Si el usuario usa los botones del navegador
    };

    window.addEventListener('popstate', stopLoading);

    // Retornar una función de limpieza para useEffect si se usa allí
    return () => {
      clearTimeout(navigationTimeout);
      window.removeEventListener('popstate', stopLoading);
      // Asegurarse de que isLoading se apague si el componente se desmonte antes de que el timeout termine
      // Esto es importante si navigateWithLoading se llama desde un efecto que puede re-ejecutarse.
      // Sin embargo, dado que se usa en onClick, la gestión principal es el clearTimeout.
      //setIsLoading(false); // Puede ser redundante si la navegación ocurre rápido
    };
  };

  useEffect(() => {
    let isMounted = true; // Para evitar actualizaciones de estado en un componente desmontado
    const fetchUser = async () => {
      if (user) {
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        if (isMounted && snap.exists()) {
          setIsPremium(snap.data().isPremium || false);
        }
      }
    };
    fetchUser();
    return () => {
      isMounted = false;
    };
  }, [user]);

  // Efecto para apagar el loading cuando la navegación se completa y el componente Home se monta/actualiza
  useEffect(() => {
    // Este efecto se ejecutará después de que la navegación haya tenido lugar
    // y el componente Home (o cualquier otro destino) se haya renderizado.
    // Si isLoading es para la transición *hacia* otra página, este setIsLoading(false)
    // apagará el loader de Home cuando se vuelva a Home o se monte inicialmente.
    setIsLoading(false);
  }, [location.pathname]); // Depende del cambio de ruta

  return (
    <div
      className="home-container"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <Navbar />
      <StatusModal isOpen={isLoading} message="Cargando..." />

      <header className="home-header">
        <h1 className="home-title">
          Sprinter
          <span className="rayo-icon">
            <svg viewBox="0 0 64 64" className="rayo-svg">
              <path
                d="M30 2 L10 34 H28 L22 62 L54 26 H34 L40 2 Z"
                fill="url(#gold-gradient)"
              />
              <defs>
                <linearGradient id="gold-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffd700" />
                  <stop offset="50%" stopColor="#ffa500" />
                  <stop offset="100%" stopColor="#ffcc00" />
                </linearGradient>
              </defs>
            </svg>
          </span>
          App
        </h1>
      </header>

      <div className="menu-grid">
        <div className="menu-card" onClick={() => navigateWithLoading('/partidas')}>
          <GiFinishLine className="menu-icon" />
          <span>Partidas</span>
        </div>
        <div className="menu-card" onClick={() => navigateWithLoading('/registro')}>
          <GiNotebook className="menu-icon" />
          <span>Registro Entreno</span>
        </div>

        <div className="menu-card" onClick={() => navigateWithLoading('/grafica')}>
          <MdTrendingUp className="menu-icon" />
          <span>Rendimiento Deportivo</span>
        </div>
        
        <div className="menu-card" onClick={() => navigateWithLoading('/controles')}>
          <GiStopwatch className="menu-icon" />
          <span>Controles PB</span>
        </div>
        <div className="menu-card" onClick={() => navigateWithLoading('/registro-gym')}>
          <GiWeightLiftingUp className="menu-icon" />
          <span>Registro GYM</span>
        </div>
        <div className="menu-card calendar-card" onClick={() => navigateWithLoading('/calendario-eventos')}>
          <GiCalendar className="menu-icon calendar-icon" />
          <span>Calendario Eventos</span>
        </div>

        <div
          className={`menu-card ia-card ${!isPremium ? 'disabled' : ''}`}
          onClick={() => {
            if (isPremium) navigateWithLoading('/chat');
            else {
              Swal.fire({
                icon: 'info',
                title: 'Suscripción necesaria',
                html: `<p>Para acceder a <strong>Coach Nova</strong>, contáctanos:</p>
                  <a href="https://wa.me/59167679528" target="_blank" class="whatsapp-link">+591 67679528</a>`,
                confirmButtonText: 'Entendido',
              });
            }
          }}
        >
          <BiBrain className="menu-icon ia-icon" />
          <span>Coach Nova</span>
        </div>
        <div className="menu-card health-card" onClick={() => navigateWithLoading('/health-profile')}>
          <FaHeartbeat className="menu-icon health-icon" />
          <span>Perfil de Salud</span>
        </div>
            
        {/* Nueva tarjeta para MyVideos */}
        <div
          className="menu-card video-analysis-card"
          onClick={() => navigateWithLoading('/my-videos')}
        >
          <FaVideo className="video-icon-animated" />
          <span>Análisis de Videos</span>
        </div>
      </div> {/* Este div de cierre estaba mal colocado o faltaba uno para el home-container */}
      

      <footer className="home-footer">
        <div className="brand">SprinterApp</div>
        <div className="legal">© 2025 SprinterApp. Todos los derechos reservados.</div>
      </footer>
    </div> // Div de cierre para home-container
  );
}