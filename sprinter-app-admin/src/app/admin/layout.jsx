import Navbar from '@/components/Navbar';

export default function ProtectedLayout({ children }) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
    </>
  );
}
