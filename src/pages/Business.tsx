import { signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { COLLECTIONS, QR_AMOUNTS, type QrAmount, type QrTokenDoc } from '@shared/model';
import { useSession } from '../auth';
import { auth, db, errorMessage, issueQr } from '../lib/firebase';

interface Qr {
  token: string;
  image: string;
  /** Hora local de caducidad: contamos con el reloj del móvil para no depender del desfase con el servidor. */
  deadline: number;
}

export default function Business() {
  const { businessId } = useSession()!;
  const [amount, setAmount] = useState<QrAmount>(1);
  const [qr, setQr] = useState<Qr | null>(null);
  const [used, setUsed] = useState<QrTokenDoc | null>(null);
  const [now, setNow] = useState(Date.now);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    setMessage('');
    setUsed(null);
    try {
      const { data } = await issueQr({ businessId: businessId!, amount });
      const image = await QRCode.toDataURL(`${location.origin}/q/${data.token}`, { width: 640, margin: 2 });
      setQr({ token: data.token, image, deadline: Date.now() + data.ttlSeconds * 1000 });
      setNow(Date.now());
    } catch (err) {
      setMessage(errorMessage(err));
    }
    setBusy(false);
  }

  // Avisa en cuanto el cliente canjea el QR.
  useEffect(() => {
    if (!qr) return;
    return onSnapshot(doc(db, COLLECTIONS.qrTokens, qr.token), (snap) => {
      const data = snap.data() as QrTokenDoc | undefined;
      if (!data?.usedAt) return;
      setUsed(data);
      setQr(null);
      navigator.vibrate?.(200);
    });
  }, [qr]);

  useEffect(() => {
    if (!qr) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [qr]);

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
      {used && (
        <p className="notice" role="status">
          Sello dado a {used.usedByName}.
          {used.result && used.result.rewardsEarned > 0 && <strong> ¡Premio conseguido!</strong>}
        </p>
      )}
      {qr && <p className="notice" role="status">Este QR ha caducado.</p>}
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
      {message && <p role="alert">{message}</p>}
      <button className="link" onClick={() => signOut(auth)}>Salir</button>
    </main>
  );
}
