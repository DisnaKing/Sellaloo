import { signOut } from 'firebase/auth';
import { collection, doc, getCountFromServer, getDoc, getDocs, limit, orderBy, query, where, type Timestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { COLLECTIONS, DEFAULT_TIMEZONE, type BusinessDoc, type VisitDoc } from '@shared/model';
import { auth, db } from '../lib/firebase';

const DAY_MS = 86_400_000;
const ABANDONED_DAYS = 14;

interface Row {
  id: string;
  business: BusinessDoc;
  lastStampMs: number | null;
  monthStamps: number;
  monthMembers: number;
}

interface Totals {
  customers: number;
  phoneCustomers: number;
  medianQrMs: number | null;
  medianOnboardingMs: number | null;
}

const ms = (t: unknown) => (t as Timestamp).toMillis();
const daysSince = (t: number) => Math.floor((Date.now() - t) / DAY_MS);
const seconds = (t: number | null) => (t === null ? '—' : `${Math.round(t / 1000)} s`);

function median(values: number[]) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

async function loadRow(id: string, business: BusinessDoc): Promise<Row> {
  const month = new Intl.DateTimeFormat('en-CA', { timeZone: business.timezone || DEFAULT_TIMEZONE })
    .format(new Date())
    .slice(0, 7);
  const [stats, last] = await Promise.all([
    getDoc(doc(db, COLLECTIONS.businesses, id, COLLECTIONS.stats, month)),
    // ponytail: cuenta también una visita deshecha; basta para saber si el comercio se usa.
    getDocs(query(collection(db, COLLECTIONS.visits), where('businessId', '==', id), orderBy('createdAt', 'desc'), limit(1))),
  ]);
  const s = stats.data() ?? {};
  return {
    id,
    business,
    lastStampMs: last.empty ? null : ms(last.docs[0]!.data().createdAt),
    monthStamps: s.stamps ?? 0,
    monthMembers: s.newMembers ?? 0,
  };
}

export default function Admin() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);

  useEffect(() => {
    void (async () => {
      const customers = collection(db, COLLECTIONS.customers);
      // ponytail: lee todos los comercios y una consulta por cada uno; paginar cuando pasen de unos cientos.
      // La mediana del QR sale de las últimas 500 visitas, no de todas.
      const [businesses, customerCount, phoneCount, visits] = await Promise.all([
        getDocs(collection(db, COLLECTIONS.businesses)),
        getCountFromServer(customers),
        getCountFromServer(query(customers, where('phoneVerified', '==', true))),
        getDocs(query(collection(db, COLLECTIONS.visits), orderBy('createdAt', 'desc'), limit(500))),
      ]);
      const list = businesses.docs.map((d) => ({ id: d.id, business: d.data() as BusinessDoc }));
      setRows(await Promise.all(list.map((b) => loadRow(b.id, b.business))));
      setTotals({
        customers: customerCount.data().count,
        phoneCustomers: phoneCount.data().count,
        medianQrMs: median(
          visits.docs.map((d) => d.data() as VisitDoc).filter((v) => v.method === 'qr' && v.flowMs !== null).map((v) => v.flowMs!),
        ),
        medianOnboardingMs: median(
          list.filter((b) => b.business.firstStampAt).map((b) => ms(b.business.firstStampAt) - ms(b.business.createdAt)),
        ),
      });
    })();
  }, []);

  if (!rows || !totals) return <p className="page">Cargando…</p>;

  return (
    <main className="page">
      <h1>Administración</h1>

      <h2>Uso del plan gratuito</h2>
      <div className="stats">
        <p><strong>{rows.length}</strong>comercios</p>
        <p><strong>{totals.customers}</strong>clientes</p>
        <p><strong>{rows.reduce((n, r) => n + r.monthStamps, 0)}</strong>sellos este mes</p>
        <p><strong>{totals.phoneCustomers}</strong>altas por teléfono</p>
      </div>
      <p>
        Las altas por teléfono gastan SMS.{' '}
        <a href={`https://console.firebase.google.com/project/${db.app.options.projectId}/usage`} target="_blank" rel="noreferrer">
          Ver el uso en la consola de Firebase
        </a>
      </p>

      <h2>Métricas</h2>
      <p>Mediana del QR (de generarlo a sellar): <strong>{seconds(totals.medianQrMs)}</strong></p>
      <p>Mediana del alta (de crear el comercio al primer sello): <strong>{seconds(totals.medianOnboardingMs)}</strong></p>

      <h2>Comercios</h2>
      {rows.map(({ id, business: b, lastStampMs, monthStamps, monthMembers }) => {
        const abandoned = daysSince(lastStampMs ?? ms(b.createdAt)) >= ABANDONED_DAYS;
        return (
          <Link key={id} className="row" to={id}>
            <span>
              <strong>{b.name}</strong>
              {!b.active && ' · desactivado'}
              {abandoned && ' · abandonado'}
            </span>
            <span>
              Último sello: {lastStampMs === null ? 'nunca' : `hace ${daysSince(lastStampMs)} días`}. Este mes: {monthStamps} sellos y{' '}
              {monthMembers} clientes nuevos. Alta hace {daysSince(ms(b.createdAt))} días.
            </span>
          </Link>
        );
      })}

      <button className="link" onClick={() => signOut(auth)}>Salir</button>
    </main>
  );
}
