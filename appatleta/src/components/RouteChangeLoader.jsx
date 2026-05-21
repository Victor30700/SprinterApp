import { useEffect, useState } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import LoadingScreen from './LoadingScreen';

export default function RouteChangeLoader({ children }) {
  const location = useLocation();
  const navigationType = useNavigationType(); // 'POP', 'PUSH', etc.
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Solo muestra el loading en cambios por navegación (no al cargar por refresh)
    if (navigationType === 'PUSH') {
      setLoading(true);
      const timeout = setTimeout(() => setLoading(false), 500); // tiempo de carga simulado
      return () => clearTimeout(timeout);
    }
  }, [location.pathname]);

  if (loading) return <LoadingScreen />;
  return children;
}
