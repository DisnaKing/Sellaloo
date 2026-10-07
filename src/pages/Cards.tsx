import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { COLLECTIONS, type CardDoc } from '@shared/model';
import { useSession } from '../auth';
import { db, logoUrlOf } from '../lib/firebase';
import { installPrompt, isIos, isStandalone } from '../lib/install';

const DISMISSED = 'install-dismissed';

/** `localStorage` puede fallar (modo privado); entonces el aviso vuelve a salir. */
function dismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED) !== null;
  } catch {
    return false;
  }
}

// ponytail: una petición a Storage por tarjeta; copiar `logoUrl` en las tarjetas si un cliente tiene muchas.
/** El logo del comercio o, si no tiene, sus iniciales («Café Demo» → «CD»). */
function Logo({ ownerUid, name }: { ownerUid: string; name: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => void logoUrlOf(ownerUid).then(setUrl), [ownerUid]);
  const initials = name.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
  return <span className="mark" aria-hidden="true">{url ? <img src={url} alt="" /> : initials}</span>;
}

export default function Cards() {
  const { user } = useSession()!;
  const [cards, setCards] = useState<(CardDoc & { id: string })[] | null>(null);
  const [now] = useState(Date.now);
  // Tras el primer sello, a quien no la tiene instalada se le propone añadirla a la pantalla de inicio.
  const [install, setInstall] = useState(() => !isStandalone() && !dismissed() && (isIos() || installPrompt !== null));

  function hideInstall() {
    setInstall(false);
    try {
      localStorage.setItem(DISMISSED, '1');
    } catch {
      // Sin almacenamiento, solo se oculta hasta que vuelva a abrir la app.
    }
  }

  async function addToHome() {
    await installPrompt?.prompt();
    hideInstall();
  }

  useEffect(
    () =>
      onSnapshot(query(collection(db, COLLECTIONS.cards), where('customerId', '==', user.uid)), (snap) =>
        setCards(snap.docs.map((d) => ({ id: d.id, ...(d.data() as CardDoc) }))),
      ),
    [user.uid],
  );

  if (!cards) return <p className="page">Cargando…</p>;
  const visible = cards
    .filter((c) => c.status !== 'redeemed')
    // Los sellos caducados no se borran hasta el siguiente sello; aquí ya se muestran a cero.
    .map((c) => (c.stampsExpireAt && c.stampsExpireAt.toMillis() <= now ? { ...c, stamps: 0 } : c));
  return (
    <main className="page">
      <h1>Mis tarjetas</h1>
      {visible.length === 0 && <p>Aún no tienes sellos. Escanea el QR de un comercio para empezar.</p>}
      {install && visible.length > 0 && (
        <div className="notice">
          {isIos() ? (
            <p>Para tener tus tarjetas a mano, pulsa Compartir y luego «Añadir a pantalla de inicio».</p>
          ) : (
            <>
              <p>Añade Sellaloo a tu pantalla de inicio para tener tus tarjetas a mano.</p>
              <button onClick={addToHome}>Añadir</button>
            </>
          )}
          <button className="link" onClick={hideInstall}>Ahora no</button>
        </div>
      )}
      {visible.map((c) => (
        <article key={c.id} className="stamp-card">
          <header>
            <Logo ownerUid={c.ownerUid} name={c.businessName} />
            <h2>{c.businessName}</h2>
            <span className="count">{c.stamps}/{c.stampsRequired}</span>
          </header>
          <div className="slots" role="img" aria-label={`${c.stamps} de ${c.stampsRequired} sellos`}>
            {Array.from({ length: c.stampsRequired }, (_, i) => (
              // La última casilla, mientras está vacía, enseña el premio.
              <span key={i} className={i < c.stamps ? 'on' : i === c.stampsRequired - 1 ? 'prize' : ''} />
            ))}
          </div>
          {c.status === 'reward_pending' ? (
            <p className="pending">
              <strong>Premio pendiente: {c.reward}. Enséñaselo al comercio.</strong>
              <span className="prize-stamp" aria-hidden="true">¡PREMIO!</span>
            </p>
          ) : (
            <p>{`Te ${c.stampsRequired - c.stamps === 1 ? 'falta' : 'faltan'} ${c.stampsRequired - c.stamps} para: ${c.reward}`}</p>
          )}
        </article>
      ))}
      <Link className="button secondary" to="/perfil">Mi perfil</Link>
    </main>
  );
}
