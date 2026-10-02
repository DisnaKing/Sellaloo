import { collection, doc, getDocs, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { COLLECTIONS, type CardDoc, type MemberDoc, type VisitDoc } from '@shared/model';
import { useSession } from '../auth';
import { db, errorMessage, redeemReward } from '../lib/firebase';

const METHODS: Record<VisitDoc['method'], string> = { qr: 'QR', phone: 'teléfono' };

/** Ficha de un cliente para el dueño. */
export default function Member() {
  const { user, businessId } = useSession()!;
  const { memberId } = useParams() as { memberId: string };
  const [member, setMember] = useState<MemberDoc | null>(null);
  const [activeCard, setCard] = useState<CardDoc | null>(null);
  const [pending, setPending] = useState<(CardDoc & { id: string })[]>([]);
  const [visits, setVisits] = useState<(VisitDoc & { id: string })[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [now] = useState(Date.now);

  useEffect(
    () =>
      onSnapshot(doc(db, COLLECTIONS.businesses, businessId!, COLLECTIONS.members, memberId), (snap) =>
        setMember((snap.data() as MemberDoc | undefined) ?? null),
      ),
    [businessId, memberId],
  );

  const activeCardId = member?.activeCardId;
  useEffect(() => {
    if (!activeCardId) return;
    return onSnapshot(doc(db, COLLECTIONS.cards, activeCardId), (snap) => setCard(snap.data() as CardDoc));
  }, [activeCardId]);

  useEffect(
    () =>
      onSnapshot(
        query(
          collection(db, COLLECTIONS.cards),
          where('ownerUid', '==', user.uid),
          where('businessId', '==', businessId),
          where('memberId', '==', memberId),
          where('status', '==', 'reward_pending'),
        ),
        (snap) => setPending(snap.docs.map((d) => ({ id: d.id, ...(d.data() as CardDoc) }))),
      ),
    [businessId, memberId, user.uid],
  );

  useEffect(() => {
    void getDocs(
      query(
        collection(db, COLLECTIONS.visits),
        where('ownerUid', '==', user.uid),
        where('memberId', '==', memberId),
        orderBy('createdAt', 'desc'),
        limit(10),
      ),
    ).then((snap) => setVisits(snap.docs.map((d) => ({ id: d.id, ...(d.data() as VisitDoc) }))));
  }, [memberId, user.uid]);

  async function redeem(cardId: string) {
    setBusy(true);
    setMessage('');
    try {
      await redeemReward({ cardId });
      setMessage('Premio entregado.');
    } catch (err) {
      setMessage(errorMessage(err));
    }
    setBusy(false);
  }

  if (!member) return <p className="page">Cargando…</p>;
  const card = activeCardId ? activeCard : null;
  // Como en la zona del cliente: los sellos caducados se ven a cero aunque aún no se hayan borrado.
  const stamps = !card || (card.stampsExpireAt && card.stampsExpireAt.toMillis() <= now) ? 0 : card.stamps;

  return (
    <main className="page">
      <h1>{member.name}</h1>
      {member.phone && <p>{member.phone}</p>}
      {card ? (
        <article className="card">
          <p className="stamps" aria-label={`${stamps} de ${card.stampsRequired} sellos`}>
            {'●'.repeat(stamps)}{'○'.repeat(Math.max(0, card.stampsRequired - stamps))}
          </p>
          <p>Le faltan {card.stampsRequired - stamps} para: {card.reward}</p>
        </article>
      ) : (
        <p>Aún no tiene sellos.</p>
      )}

      {message && <p role="status">{message}</p>}
      {pending.length > 0 && (
        <section>
          <h2>Premios pendientes</h2>
          {pending.map((c) => (
            <div key={c.id} className="row">
              <span>{c.reward}</span>
              <button disabled={busy} onClick={() => redeem(c.id)}>Canjear</button>
            </div>
          ))}
        </section>
      )}

      <section>
        <h2>Últimas visitas</h2>
        {visits.length === 0 && <p>Todavía no ha venido.</p>}
        {visits.map((v) => (
          <div key={v.id} className="row">
            <span>{v.createdAt.toDate().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</span>
            <span>
              {v.undoneAt ? 'deshecha' : `+${v.amount} por ${METHODS[v.method]}`}
            </span>
          </div>
        ))}
      </section>
      <Link className="link" to="/negocio/clientes">Volver</Link>
    </main>
  );
}
