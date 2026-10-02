import { doc, updateDoc } from 'firebase/firestore';
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { COLLECTIONS, MAX_STAMPS_REQUIRED, MIN_STAMPS_REQUIRED, PROGRAM_TEMPLATES } from '@shared/model';
import { useSession } from '../auth';
import { createBusiness, db, errorMessage, uploadLogo } from '../lib/firebase';

/** Asistente de alta del comercio: un paso por pantalla. */
export default function Onboarding() {
  const session = useSession();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [logo, setLogo] = useState<File | null>(null);
  const [stampsRequired, setStampsRequired] = useState(10);
  const [rewardDescription, setRewardDescription] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  if (session === undefined) return <p className="page">Cargando…</p>;
  if (!session) return <Navigate to="/negocio/entrar" replace />;
  if (session.role === 'owner' && step < 4) return <Navigate to="/negocio" replace />;
  if (session.role === 'admin' || (session.role === 'customer' && session.hasProfile)) return <Navigate to="/" replace />;

  function chooseType(e: FormEvent) {
    e.preventDefault();
    const template = PROGRAM_TEMPLATES.find((t) => t.businessType === type)!;
    setStampsRequired(template.stampsRequired);
    setRewardDescription(template.rewardDescription);
    setStep(2);
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const { data } = await createBusiness({ name, type, stampsRequired, rewardDescription });
      // Si el logo falla, el comercio ya existe: se puede subir luego en Ajustes.
      if (logo) {
        try {
          const logoUrl = await uploadLogo(session!.user.uid, logo);
          await updateDoc(doc(db, COLLECTIONS.businesses, data.businessId), { logoUrl });
        } catch {
          setMessage('No hemos podido subir el logo. Pruébalo otra vez en Ajustes.');
        }
      }
      setStep(4);
      await session!.refresh();
    } catch (err) {
      setMessage(errorMessage(err));
    }
    setBusy(false);
  }

  return (
    <main className="page">
      <p>Paso {step} de 4</p>
      {step === 1 && (
        <form onSubmit={chooseType}>
          <h1>Tu comercio</h1>
          <label>Nombre<input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label>
            Tipo de negocio
            <select required value={type} onChange={(e) => setType(e.target.value)}>
              <option value="" disabled>Elige uno</option>
              {PROGRAM_TEMPLATES.map((t) => <option key={t.businessType} value={t.businessType}>{t.label}</option>)}
            </select>
          </label>
          <button>Siguiente</button>
        </form>
      )}
      {step === 2 && (
        <form onSubmit={(e) => { e.preventDefault(); setStep(3); }}>
          <h1>Tu logo</h1>
          <p>Saldrá en las tarjetas de tus clientes. Puedes ponerlo más tarde.</p>
          <label>Imagen<input type="file" accept="image/*" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} /></label>
          <button>{logo ? 'Siguiente' : 'Saltar'}</button>
        </form>
      )}
      {step === 3 && (
        <form onSubmit={create}>
          <h1>Tu tarjeta</h1>
          <label>
            Sellos para el premio
            <input type="number" required min={MIN_STAMPS_REQUIRED} max={MAX_STAMPS_REQUIRED} value={stampsRequired} onChange={(e) => setStampsRequired(e.target.valueAsNumber)} />
          </label>
          <label>Premio<input required maxLength={80} value={rewardDescription} onChange={(e) => setRewardDescription(e.target.value)} /></label>
          <button disabled={busy}>Crear mi comercio</button>
        </form>
      )}
      {step === 4 && (
        <>
          <h1>¡Listo!</h1>
          <p>Ya puedes dar sellos. Prueba con tu primer cliente.</p>
          <button className="big" onClick={() => navigate('/negocio', { state: { welcome: true } })}>Da tu primer sello</button>
        </>
      )}
      {message && <p role="alert">{message}</p>}
      {(step === 2 || step === 3) && !busy && (
        <button className="link" onClick={() => setStep(step - 1)}>Atrás</button>
      )}
    </main>
  );
}
