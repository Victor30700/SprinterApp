'use client';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';

export default function Navbar() {
  const router = useRouter();

  const handleLogout = () => {
    Cookies.remove('__session');
    router.push('/login');
  };

  return (
    <nav className="flex justify-between items-center p-4 bg-gray-800 text-white">
      <button onClick={() => router.push('/admin/users')}>
        🏠
      </button>
      <div className="text-lg font-bold">Mi Logo</div>
      <button onClick={handleLogout}>
        Cerrar Sesión
      </button>
    </nav>
  );
}
