import {
  createUserWithEmailAndPassword,
  linkWithPhoneNumber,
  RecaptchaVerifier,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  type ConfirmationResult,
  type User,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { COLLECTIONS } from '@shared/model';
import { useSession } from '../auth';
import { auth, claimPhoneCards, db, errorMessage } from '../lib/firebase';

/** Pasa «600 00 00 01» a «+34600000001»; si ya lleva prefijo, lo respeta. */
function toE164(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '');
  return digits.startsWith('+') ? digits : `+34${digits}`;
}

export type Run = (action: () => Promise<unknown>) => Promise<void>;

export default function CustomerLogin() {
  const session = useSession();
  const [params] = useSearchParams();
  const next = params.get('next') ?? '/tarjetas';
  const [mode, setMode] = useState<'choose' | 'phone' | 'email'>('choose');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const run: Run = async (action) => {
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch (err) {
      setMessage(errorMessage(err));
    }
    setBusy(false);
  };

  if (session === undefined) return <p className="page">Cargando…</p>;
  if (session && session.role !== 'customer') return <Navigate to="/" replace />;
  if (session?.hasProfile) return <Navigate to={next} replace />;

  return (
    <main className="page">
      {next.startsWith('/q/') && <p className="notice">Entra para recibir tu sello.</p>}
      {session ? (
        <ProfileForm run={run} busy={busy} />
      ) : mode === 'choose' ? (
        <>
          <h1>Entrar</h1>
          <button onClick={() => setMode('phone')}>Con mi teléfono</button>
          <button className="secondary" onClick={() => setMode('email')}>Con mi correo</button>
        </>
      ) : mode === 'phone' ? (
        <>
          <h1>Con mi teléfono</h1>
          <PhoneForm run={run} busy={busy} />
        </>
      ) : (
        <EmailForm run={run} busy={busy} setMessage={setMessage} />
      )}
      {message && <p role="alert">{message}</p>}
    </main>
  );
}

/** Entra con el teléfono o, con `link`, se lo añade a esa cuenta y luego llama a `onDone`. */
export function PhoneForm({ run, busy, link, onDone }: { run: Run; busy: boolean; link?: User; onDone?: () => Promise<void> }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (confirmation)
      return run(async () => {
        await confirmation.confirm(code);
        await onDone?.();
      });
    return run(async () => {
      const verifier = new RecaptchaVerifier(auth, 'recaptcha', { size: 'invisible' });
      setConfirmation(
        await (link ? linkWithPhoneNumber(link, toE164(phone), verifier) : signInWithPhoneNumber(auth, toE164(phone), verifier)),
      );
    });
  }

  return (
    <form onSubmit={submit}>
      {confirmation ? (
        <label>
          Código del SMS
          <input inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)} />
        </label>
      ) : (
        <label>
          Teléfono
          <input type="tel" autoComplete="tel" placeholder="600 000 000" required value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
      )}
      <button disabled={busy}>{confirmation ? (link ? 'Guardar' : 'Entrar') : 'Enviarme el código'}</button>
      <div id="recaptcha" />
    </form>
  );
}

function EmailForm({ run, busy, setMessage }: { run: Run; busy: boolean; setMessage: (m: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function reset() {
    if (!email) return setMessage('Escribe tu correo y vuelve a pulsar.');
    return run(async () => {
      await sendPasswordResetEmail(auth, email);
      setMessage('Te hemos enviado un correo para cambiar la contraseña.');
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const register = (e.nativeEvent as SubmitEvent).submitter?.dataset.register !== undefined;
        void run(() => (register ? createUserWithEmailAndPassword : signInWithEmailAndPassword)(auth, email, password));
      }}
    >
      <h1>Con mi correo</h1>
      <label>Correo<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label>Contraseña<input type="password" autoComplete="current-password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      <button disabled={busy}>Entrar</button>
      <button className="secondary" data-register disabled={busy}>Crear cuenta</button>
      <button type="button" className="link" onClick={reset}>¿Has olvidado tu contraseña?</button>
    </form>
  );
}

function ProfileForm({ run, busy }: { run: Run; busy: boolean }) {
  const session = useSession()!;
  const [name, setName] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    const { uid, email, phoneNumber } = session.user;
    return run(async () => {
      // Las reglas exigen que `phoneVerified` coincida con el teléfono del login por SMS.
      await setDoc(doc(db, COLLECTIONS.customers, uid), {
        name: name.trim(),
        email,
        phone: phoneNumber,
        phoneVerified: phoneNumber !== null,
        privacyAcceptedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
      try {
        // Junta las fichas que algún comercio le hizo a mano con este teléfono.
        // ponytail: si falla, esas tarjetas esperan; Perfil no ofrece reintentarlo.
        if (phoneNumber) await claimPhoneCards();
      } finally {
        await session.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit}>
      <h1>¿Cómo te llamas?</h1>
      <label>Nombre<input autoComplete="given-name" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="check">
        <input type="checkbox" required />
        {/* Se abre aparte para no perder lo escrito en el formulario. */}
        <span>Acepto la <a href="/legal#privacidad" target="_blank">política de privacidad</a></span>
      </label>
      <button disabled={busy}>Continuar</button>
      {/* Quien deja el alta del comercio a medias acaba aquí: su cuenta aún no tiene comercio. */}
      <Link className="link" to="/negocio/alta">¿Eres un comercio? Crear mi comercio</Link>
    </form>
  );
}
