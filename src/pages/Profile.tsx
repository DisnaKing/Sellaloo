import { EmailAuthProvider, linkWithCredential, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { COLLECTIONS, type CustomerDoc } from '@shared/model';
import { useSession } from '../auth';
import { auth, claimPhoneCards, db, deleteAccount, errorMessage } from '../lib/firebase';
import { PhoneForm, type Run } from './CustomerLogin';

export default function Profile() {
  const { user, refresh } = useSession()!;
  const ref = doc(db, COLLECTIONS.customers, user.uid);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getDoc(doc(db, COLLECTIONS.customers, user.uid)).then((snap) => setName((snap.data() as CustomerDoc).name));
  }, [user.uid]);

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

  function saveName(e: FormEvent) {
    e.preventDefault();
    // ponytail: las fichas de los comercios conservan el nombre antiguo hasta el siguiente sello.
    return run(async () => {
      await updateDoc(ref, { name: name.trim() });
      setMessage('Nombre guardado.');
    });
  }

  // Las reglas comparan teléfono y correo con los del token: hay que renovarlo tras añadirlos.
  async function phoneAdded() {
    await user.getIdToken(true);
    const { data } = await claimPhoneCards();
    await refresh();
    setMessage(data.claimed > 0 ? 'Teléfono guardado. Hemos juntado tus tarjetas.' : 'Teléfono guardado.');
  }

  function addEmail(e: FormEvent) {
    e.preventDefault();
    return run(async () => {
      await linkWithCredential(user, EmailAuthProvider.credential(email, password));
      await user.getIdToken(true);
      await updateDoc(ref, { email: user.email });
      await refresh();
      setMessage('Correo guardado.');
    });
  }

  const remove = () =>
    run(async () => {
      await deleteAccount();
      await signOut(auth);
    });

  return (
    <main className="page">
      <h1>Mi perfil</h1>
      {message && <p role="status">{message}</p>}
      <form onSubmit={saveName}>
        <label>Nombre<input autoComplete="given-name" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} /></label>
        <button disabled={busy}>Guardar nombre</button>
      </form>

      <section>
        <h2>Teléfono</h2>
        {user.phoneNumber ? (
          <p>{user.phoneNumber}</p>
        ) : (
          <>
            <p>Con tu teléfono el comercio te puede dar sellos sin QR, y se juntan las tarjetas que te haya hecho.</p>
            <PhoneForm run={run} busy={busy} link={user} onDone={phoneAdded} />
          </>
        )}
      </section>

      <section>
        <h2>Correo</h2>
        {user.email ? (
          <p>{user.email}</p>
        ) : (
          <form onSubmit={addEmail}>
            <p>Para entrar también con correo y contraseña.</p>
            <label>Correo<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label>Contraseña<input type="password" autoComplete="new-password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            <button disabled={busy}>Guardar correo</button>
          </form>
        )}
      </section>

      <section>
        <h2>Borrar mi cuenta</h2>
        {confirmDelete ? (
          <>
            <p>Se borran tu nombre, tu teléfono y tu correo, y pierdes tus sellos. No se puede deshacer.</p>
            <button disabled={busy} onClick={remove}>Sí, borrar mi cuenta</button>
            <button className="secondary" disabled={busy} onClick={() => setConfirmDelete(false)}>Cancelar</button>
          </>
        ) : (
          <button className="secondary" onClick={() => setConfirmDelete(true)}>Borrar mi cuenta</button>
        )}
      </section>

      <button className="link" onClick={() => signOut(auth)}>Salir</button>
      <Link className="link" to="/tarjetas">Volver</Link>
    </main>
  );
}
