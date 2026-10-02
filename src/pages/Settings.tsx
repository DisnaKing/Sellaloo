import { collection, doc, getDoc, getDocs, limit, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import {
  COLLECTIONS,
  MAX_STAMPS_REQUIRED,
  MIN_STAMPS_REQUIRED,
  PROGRAM_TEMPLATES,
  type BusinessDoc,
  type ProgramDoc,
} from '@shared/model';
import { useSession } from '../auth';
import { db, errorMessage, uploadLogo } from '../lib/firebase';

interface Form {
  name: string;
  type: string;
  logoUrl: string | null;
  /** En los `<select>` el «sin límite» y el «no caducan» van como cadena vacía. */
  dailyVisitLimit: string;
  programId: string;
  stampsRequired: number;
  rewardDescription: string;
  stampExpiryMonths: string;
  active: boolean;
}

const toNumber = (v: string) => (v === '' ? null : Number(v));

/** Ajustes del dueño (`/negocio/ajustes`) y ficha del admin (`/admin/:businessId`). */
export default function Settings() {
  const { user, role, businessId: ownBusinessId } = useSession()!;
  const businessId = useParams().businessId ?? ownBusinessId;
  const isAdmin = role === 'admin';
  const [form, setForm] = useState<Form | null>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const b = (await getDoc(doc(db, COLLECTIONS.businesses, businessId!))).data() as BusinessDoc;
      const programs = await getDocs(
        query(
          collection(db, COLLECTIONS.businesses, businessId!, COLLECTIONS.programs),
          where('ownerUid', '==', b.ownerUid),
          where('active', '==', true),
          limit(1),
        ),
      );
      const p = programs.docs[0]!;
      const program = p.data() as ProgramDoc;
      setForm({
        name: b.name,
        type: b.type,
        logoUrl: b.logoUrl,
        dailyVisitLimit: String(b.dailyVisitLimit ?? ''),
        programId: p.id,
        stampsRequired: program.stampsRequired,
        rewardDescription: program.rewardDescription,
        stampExpiryMonths: String(program.stampExpiryMonths ?? ''),
        active: b.active,
      });
    })();
  }, [businessId]);

  if (!form) return <p className="page">Cargando…</p>;
  const set = (patch: Partial<Form>) => setForm({ ...form, ...patch });

  const businessRef = doc(db, COLLECTIONS.businesses, businessId!);

  async function toggleActive() {
    setBusy(true);
    try {
      await updateDoc(businessRef, { active: !form!.active });
      setForm({ ...form!, active: !form!.active });
    } catch (err) {
      setMessage(errorMessage(err));
    }
    setBusy(false);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const logoUrl = logo ? await uploadLogo(user.uid, logo) : form!.logoUrl;
      await Promise.all([
        updateDoc(businessRef, {
          name: form!.name.trim(),
          type: form!.type,
          logoUrl,
          dailyVisitLimit: toNumber(form!.dailyVisitLimit),
        }),
        updateDoc(doc(businessRef, COLLECTIONS.programs, form!.programId), {
          stampsRequired: form!.stampsRequired,
          rewardDescription: form!.rewardDescription.trim(),
          stampExpiryMonths: toNumber(form!.stampExpiryMonths),
        }),
      ]);
      setForm({ ...form!, logoUrl });
      setLogo(null);
      setMessage('Guardado.');
    } catch (err) {
      setMessage(errorMessage(err));
    }
    setBusy(false);
  }

  return (
    <main className="page">
      <h1>{isAdmin ? form.name : 'Ajustes'}</h1>
      {isAdmin && (
        <>
          <p>{form.active ? 'Activo.' : 'Desactivado: no puede generar QR ni sellar.'}</p>
          <button className="secondary" disabled={busy} onClick={toggleActive}>{form.active ? 'Desactivar' : 'Activar'}</button>
        </>
      )}
      <form onSubmit={save}>
        <label>Nombre<input required maxLength={80} value={form.name} onChange={(e) => set({ name: e.target.value })} /></label>
        <label>
          Tipo de negocio
          <select value={form.type} onChange={(e) => set({ type: e.target.value })}>
            {PROGRAM_TEMPLATES.map((t) => <option key={t.businessType} value={t.businessType}>{t.label}</option>)}
          </select>
        </label>
        {form.logoUrl && <img className="logo" src={form.logoUrl} alt="Logo actual" />}
        {/* ponytail: el admin no cambia el logo (Storage solo deja subirlo al dueño). */}
        {!isAdmin && <label>Logo<input type="file" accept="image/*" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} /></label>}
        <label>
          Sellos por cliente y día
          <select value={form.dailyVisitLimit} onChange={(e) => set({ dailyVisitLimit: e.target.value })}>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="">Sin límite</option>
          </select>
        </label>
        <h2>Tarjeta</h2>
        <p>Los cambios valen para las tarjetas nuevas; las que están en curso siguen igual.</p>
        <label>
          Sellos para el premio
          <input type="number" required min={MIN_STAMPS_REQUIRED} max={MAX_STAMPS_REQUIRED} value={form.stampsRequired} onChange={(e) => set({ stampsRequired: e.target.valueAsNumber })} />
        </label>
        <label>Premio<input required maxLength={80} value={form.rewardDescription} onChange={(e) => set({ rewardDescription: e.target.value })} /></label>
        <label>
          Los sellos caducan
          <select value={form.stampExpiryMonths} onChange={(e) => set({ stampExpiryMonths: e.target.value })}>
            <option value="">Nunca</option>
            <option value="3">A los 3 meses sin venir</option>
            <option value="6">A los 6 meses sin venir</option>
            <option value="12">A los 12 meses sin venir</option>
          </select>
        </label>
        <button disabled={busy}>Guardar</button>
      </form>
      {message && <p role="status">{message}</p>}
      <Link className="link" to={isAdmin ? '/admin' : '/negocio'}>Volver</Link>
    </main>
  );
}
