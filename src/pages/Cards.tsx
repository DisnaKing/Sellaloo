import { signOut } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { COLLECTIONS, type CardDoc } from '@shared/model';
import { useSession } from '../auth';
import { auth, db } from '../lib/firebase';

export default function Cards() {
  const { user } = useSession()!;
  const [cards, setCards] = useState<(CardDoc & { id: string })[] | null>(null);
  const [now] = useState(Date.now);

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
      {visible.map((c) => (
        <article key={c.id} className="card">
          <h2>{c.businessName}</h2>
          <p className="stamps" aria-label={`${c.stamps} de ${c.stampsRequired} sellos`}>
            {'●'.repeat(c.stamps)}{'○'.repeat(Math.max(0, c.stampsRequired - c.stamps))}
          </p>
          <p>{c.status === 'reward_pending' ? <strong>¡Premio listo! Pídelo en el mostrador: {c.reward}</strong> : `Premio: ${c.reward}`}</p>
        </article>
      ))}
      <button className="link" onClick={() => signOut(auth)}>Salir</button>
    </main>
  );
}
