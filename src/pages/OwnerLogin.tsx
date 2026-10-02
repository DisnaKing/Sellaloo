import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router';
import { useSession } from '../auth';
import { auth, errorMessage } from '../lib/firebase';

export default function OwnerLogin() {
  const session = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  if (session === undefined) return <p className="page">Cargando…</p>;
  // Una cuenta sin comercio ni perfil de cliente está a medio alta: sigue con el asistente.
  if (session) return <Navigate to={session.role === 'customer' && !session.hasProfile ? '/negocio/alta' : '/'} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const register = (e.nativeEvent as SubmitEvent).submitter?.dataset.register !== undefined;
    setBusy(true);
    try {
      if (!register) await signInWithEmailAndPassword(auth, email, password);
      else {
        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        // No bloquea el alta: si falla, el comercio sigue igual.
        sendEmailVerification(user).catch(() => {});
      }
    } catch (err) {
      setMessage(errorMessage(err));
      setBusy(false);
    }
  }

  async function reset() {
    if (!email) return setMessage('Escribe tu correo y vuelve a pulsar.');
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('Te hemos enviado un correo para cambiar la contraseña.');
    } catch (err) {
      setMessage(errorMessage(err));
    }
  }

  return (
    <main className="page">
      <h1>Entrar como comercio</h1>
      <form onSubmit={submit}>
        <label>Correo<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Contraseña<input type="password" autoComplete="current-password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <button disabled={busy}>Entrar</button>
        <button className="secondary" data-register disabled={busy}>Crear mi comercio</button>
      </form>
      <button type="button" className="link" onClick={reset}>¿Has olvidado tu contraseña?</button>
      {message && <p role="alert">{message}</p>}
    </main>
  );
}
