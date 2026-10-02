import { signOut } from 'firebase/auth';
import { collection, doc, getDocs, limit, onSnapshot, query, where } from 'firebase/firestore';
import QRCode from 'qrcode';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router';
import { COLLECTIONS, QR_AMOUNTS, type MemberDoc, type QrAmount, type QrTokenDoc } from '@shared/model';
import { useSession } from '../auth';
import {
  addMember,
  auth,
  db,
  errorMessage,
  issueQr,
  redeemReward,
  stampByPhone,
  undoLastVisit,
} from '../lib/firebase';

interface Qr {
  token: string;
  image: string;
  /** Hora local de caducidad: contamos con el reloj del móvil para no depender del desfase con el servidor. */
  deadline: number;
}

interface Stamped {
  name: string;
  rewardsEarned: number;
}

/** Los mensajes de error se escribieron para el cliente; aquí los lee el dueño. */
function ownerMessage(err: unknown): string {
  const reason = (err as { details?: { reason?: string } }).details?.reason;
  if (reason === 'daily-limit') return 'Este cliente ya ha recibido hoy su sello.';
  return errorMessage(err);
}

export default function Business() {
  const { user, businessId } = useSession()!;
  const [amount, setAmount] = useState<QrAmount>(1);
  const [qr, setQr] = useState<Qr | null>(null);
  const [stamped, setStamped] = useState<Stamped | null>(null);
  const [now, setNow] = useState(Date.now);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState('');
  // Si el teléfono no es de nadie, el formulario pide también el nombre para darlo de alta.
  const [name, setName] = useState<string | null>(null);
  const [pending, setPending] = useState<(MemberDoc & { id: string })[]>([]);
  // Recién dado de alta: el asistente llega aquí con `welcome`.
  const welcome = (useLocation().state as { welcome?: boolean } | null)?.welcome && !stamped;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch (err) {
      setMessage(ownerMessage(err));
    }
    setBusy(false);
  }

  const generate = () =>
    run(async () => {
      setStamped(null);
      const { data } = await issueQr({ businessId: businessId!, amount });
      const image = await QRCode.toDataURL(`${location.origin}/q/${data.token}`, { width: 640, margin: 2 });
      setQr({ token: data.token, image, deadline: Date.now() + data.ttlSeconds * 1000 });
      setNow(Date.now());
    });

  function stampPhone(e: FormEvent) {
    e.preventDefault();
    return run(async () => {
      setStamped(null);
      try {
        if (name !== null) await addMember({ businessId: businessId!, name, phone });
        const { data } = await stampByPhone({ businessId: businessId!, phone, amount });
        setStamped(data);
        setPhone('');
        setName(null);
      } catch (err) {
        if ((err as { details?: { reason?: string } }).details?.reason !== 'unknown-phone') throw err;
        setName('');
        setMessage('No hay ningún cliente con ese teléfono. Escribe su nombre para darlo de alta.');
      }
    });
  }

  const undo = () =>
    run(async () => {
      const { data } = await undoLastVisit({ businessId: businessId! });
      setStamped(null);
      setMessage(`Deshecho: ${data.amount} ${data.amount === 1 ? 'sello' : 'sellos'} de ${data.name}.`);
    });

  // Canjea la tarjeta completada más antigua que encuentre; el orden da igual para el cliente.
  const redeem = (m: MemberDoc & { id: string }) =>
    run(async () => {
      const snap = await getDocs(
        query(
          collection(db, COLLECTIONS.cards),
          where('ownerUid', '==', user.uid),
          where('businessId', '==', businessId),
          where('memberId', '==', m.id),
          where('status', '==', 'reward_pending'),
          limit(1),
        ),
      );
      if (!snap.docs[0]) return;
      await redeemReward({ cardId: snap.docs[0].id });
      setMessage(`Premio entregado a ${m.name}.`);
    });

  // Avisa en cuanto el cliente canjea el QR.
  useEffect(() => {
    if (!qr) return;
    return onSnapshot(doc(db, COLLECTIONS.qrTokens, qr.token), (snap) => {
      const data = snap.data() as QrTokenDoc | undefined;
      if (!data?.usedAt) return;
      setStamped({ name: data.usedByName ?? '', rewardsEarned: data.result?.rewardsEarned ?? 0 });
      setQr(null);
      navigator.vibrate?.(200);
    });
  }, [qr]);

  useEffect(() => {
    if (!qr) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [qr]);

  useEffect(() => {
    if (!businessId) return;
    return onSnapshot(
      query(
        collection(db, COLLECTIONS.businesses, businessId, COLLECTIONS.members),
        where('ownerUid', '==', user.uid),
        where('rewardsPending', '>', 0),
      ),
      (snap) => setPending(snap.docs.map((d) => ({ id: d.id, ...(d.data() as MemberDoc) }))),
    );
  }, [businessId, user.uid]);

  const secondsLeft = qr ? Math.max(0, Math.ceil((qr.deadline - now) / 1000)) : 0;

  if (qr && secondsLeft > 0) {
    return (
      <main className="page qr">
        <img src={qr.image} alt="QR para dar el sello" />
        <p>Que el cliente lo escanee con la cámara. Caduca en {secondsLeft} s.</p>
        <button className="secondary" onClick={() => setQr(null)}>Cancelar</button>
      </main>
    );
  }

  return (
    <main className="page">
      {stamped && (
        <div className="notice" role="status">
          <p>
            Sello dado a {stamped.name}.
            {stamped.rewardsEarned > 0 && <strong> ¡Premio conseguido!</strong>}
          </p>
          <button className="secondary" disabled={busy} onClick={undo}>Deshacer</button>
        </div>
      )}
      {qr && <p className="notice" role="status">Este QR ha caducado.</p>}
      {message && <p role="alert">{message}</p>}

      {welcome && (
        <p className="notice">
          Elige cuántos sellos das y pulsa «Generar QR». El cliente lo escanea con la cámara del móvil, sin
          instalar nada.
        </p>
      )}
      <h1>Dar sellos</h1>
      <div className="amounts" role="radiogroup" aria-label="Sellos">
        {QR_AMOUNTS.map((n) => (
          <button key={n} role="radio" aria-checked={amount === n} className={amount === n ? '' : 'secondary'} onClick={() => setAmount(n)}>
            {n}
          </button>
        ))}
      </div>
      <button className="big" disabled={busy || !businessId} onClick={generate}>
        {qr ? 'Generar otro' : 'Generar QR'}
      </button>

      <form onSubmit={stampPhone}>
        <label>
          O por teléfono
          <input type="tel" autoComplete="off" required value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        {name !== null && (
          <label>
            Nombre
            <input autoFocus required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        )}
        <button disabled={busy || !businessId}>{name === null ? 'Dar sello' : 'Dar de alta y dar sello'}</button>
      </form>

      {pending.length > 0 && (
        <section>
          <h2>Premios pendientes</h2>
          {pending.map((m) => (
            <div key={m.id} className="row">
              <span>
                {m.name}
                {m.rewardsPending > 1 && ` (${m.rewardsPending})`}
              </span>
              <button disabled={busy} onClick={() => redeem(m)}>Entregar</button>
            </div>
          ))}
        </section>
      )}

      <Link className="button secondary" to="/negocio/clientes">Clientes</Link>
      <Link className="button secondary" to="/negocio/ajustes">Ajustes</Link>
      <button className="link" onClick={() => signOut(auth)}>Salir</button>
    </main>
  );
}
