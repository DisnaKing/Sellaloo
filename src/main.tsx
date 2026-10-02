import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Link, Navigate } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { AuthProvider, RequireRole, useSession, type Role } from './auth';
import './styles.css';

function Home() {
  const session = useSession();
  if (session === undefined) return <p className="page">Cargando…</p>;
  if (session?.role === 'owner') return <Navigate to="/negocio" replace />;
  if (session?.role === 'customer') return <Navigate to="/tarjetas" replace />;
  // ponytail: el panel de admin llega en la fase 6.
  if (session?.role === 'admin') return <p className="page">Panel de administración: próximamente.</p>;
  return (
    <main className="page">
      <h1>Sellaloo</h1>
      <Link className="button" to="/entrar">Ver mis tarjetas</Link>
      <Link className="button secondary" to="/negocio/entrar">Soy un comercio</Link>
      <Link className="button secondary" to="/negocio/alta">Crear mi comercio</Link>
    </main>
  );
}

/** Ruta que carga su pantalla bajo demanda y solo la muestra al rol indicado. */
function guarded(role: Role, load: () => Promise<{ default: () => React.ReactNode }>) {
  return async () => {
    const { default: Page } = await load();
    return { Component: () => <RequireRole role={role}><Page /></RequireRole> };
  };
}

const router = createBrowserRouter([
  { path: '/', Component: Home },
  { path: '/entrar', lazy: async () => ({ Component: (await import('./pages/CustomerLogin')).default }) },
  { path: '/negocio/entrar', lazy: async () => ({ Component: (await import('./pages/OwnerLogin')).default }) },
  { path: '/negocio', lazy: guarded('owner', () => import('./pages/Business')) },
  { path: '/negocio/alta', lazy: async () => ({ Component: (await import('./pages/Onboarding')).default }) },
  { path: '/negocio/ajustes', lazy: guarded('owner', () => import('./pages/Settings')) },
  { path: '/q/:token', lazy: guarded('customer', () => import('./pages/Redeem')) },
  { path: '/tarjetas', lazy: guarded('customer', () => import('./pages/Cards')) },
  { path: '*', element: <Navigate to="/" replace /> },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
);
