import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { COLLECTIONS } from '@shared/model';
import { auth, db } from './lib/firebase';

export type Role = 'admin' | 'owner' | 'customer';

interface Session {
  user: User;
  role: Role;
  /** Comercio del dueño; `null` para clientes y admins. */
  businessId: string | null;
  /** El cliente ya tiene `customers/{uid}`. */
  hasProfile: boolean;
  refresh: () => Promise<void>;
}

/** `undefined` mientras carga; `null` sin sesión. */
const AuthContext = createContext<Session | null | undefined>(undefined);

async function loadSession(user: User, refresh: () => Promise<void>): Promise<Session> {
  const token = await user.getIdTokenResult();
  if (token.claims.admin === true) return { user, role: 'admin', businessId: null, hasProfile: false, refresh };
  const [owned, profile] = await Promise.all([
    getDocs(query(collection(db, COLLECTIONS.businesses), where('ownerUid', '==', user.uid), limit(1))),
    getDoc(doc(db, COLLECTIONS.customers, user.uid)),
  ]);
  const business = owned.docs[0];
  if (business) return { user, role: 'owner', businessId: business.id, hasProfile: false, refresh };
  return { user, role: 'customer', businessId: null, hasProfile: profile.exists(), refresh };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(
    () =>
      onAuthStateChanged(auth, async (user) => {
        if (!user) return setSession(null);
        const refresh = async () => setSession(await loadSession(user, refresh));
        await refresh();
      }),
    [],
  );

  return <AuthContext value={session}>{children}</AuthContext>;
}

export function useSession(): Session | null | undefined {
  return useContext(AuthContext);
}

/** Pantalla solo para un rol. Sin sesión, manda al login de ese rol y vuelve aquí después. */
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const session = useSession();
  const location = useLocation();
  if (session === undefined) return <p className="page">Cargando…</p>;
  const next = encodeURIComponent(location.pathname);
  if (!session) return <Navigate to={`${role === 'owner' ? '/negocio/entrar' : '/entrar'}?next=${next}`} replace />;
  if (session.role !== role) return <Navigate to="/" replace />;
  if (role === 'customer' && !session.hasProfile) return <Navigate to={`/entrar?next=${next}`} replace />;
  return children;
}
