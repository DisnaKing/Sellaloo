import { collection, doc, documentId, endAt, getDoc, getDocs, limit, orderBy, query, startAt, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { COLLECTIONS, DEFAULT_TIMEZONE, toSearchName, type BusinessDoc, type MemberDoc } from '@shared/model';
import { useSession } from '../auth';
import { db } from '../lib/firebase';

type Stats = Partial<Record<'newMembers' | 'stamps' | 'rewardsRedeemed', number>>;

/** Últimos visitantes o, si hay texto, búsqueda por prefijo del nombre o del teléfono. */
function membersQuery(businessId: string, uid: string, text: string) {
  const col = collection(db, COLLECTIONS.businesses, businessId, COLLECTIONS.members);
  const mine = where('ownerUid', '==', uid);
  const q = text.trim();
  if (!q) return query(col, mine, orderBy('lastVisitAt', 'desc'), limit(20));
  let field = 'searchName';
  // ponytail: solo encuentra por el principio del nombre; buscar por apellido pide guardar las palabras.
  let prefix = toSearchName(q);
  if (/^[+\d\s]+$/.test(q)) {
    field = 'phone';
    // ponytail: sin prefijo internacional, España (+34), como `normalizePhone`.
    prefix = (q.startsWith('+') ? '+' : '+34') + q.replace(/\D/g, '');
  }
  return query(col, mine, orderBy(field), startAt(prefix), endAt(prefix + ''), limit(20));
}

export default function Customers() {
  const { user, businessId } = useSession()!;
  const [stats, setStats] = useState<{ month: Stats; total: Stats } | null>(null);
  const [text, setText] = useState('');
  const [members, setMembers] = useState<(MemberDoc & { id: string })[] | null>(null);

  useEffect(() => {
    void (async () => {
      const business = (await getDoc(doc(db, COLLECTIONS.businesses, businessId!))).data() as BusinessDoc;
      // El mes del comercio, no el del móvil: `stats/{AAAA-MM}` usa su zona horaria.
      const month = new Intl.DateTimeFormat('en-CA', { timeZone: business.timezone || DEFAULT_TIMEZONE })
        .format(new Date())
        .slice(0, 7);
      // Un `get` de un documento que aún no existe lo rechazan las reglas; una consulta no.
      // `total` va detrás de cualquier `AAAA-MM`, así que el rango trae el mes actual y el total.
      const snap = await getDocs(
        query(
          collection(db, COLLECTIONS.businesses, businessId!, COLLECTIONS.stats),
          where('ownerUid', '==', user.uid),
          where(documentId(), '>=', month),
        ),
      );
      const byId = (id: string) => (snap.docs.find((d) => d.id === id)?.data() ?? {}) as Stats;
      setStats({ month: byId(month), total: byId('total') });
    })();
  }, [businessId, user.uid]);

  useEffect(() => {
    let current = true;
    // Espera a que deje de escribir para no lanzar una consulta por tecla.
    const id = setTimeout(async () => {
      const snap = await getDocs(membersQuery(businessId!, user.uid, text));
      if (current) setMembers(snap.docs.map((d) => ({ id: d.id, ...(d.data() as MemberDoc) })));
    }, 300);
    return () => {
      current = false;
      clearTimeout(id);
    };
  }, [businessId, user.uid, text]);

  return (
    <main className="page">
      <h1>Clientes</h1>
      {stats && (
        <div className="stats">
          <p><strong>{stats.total.newMembers ?? 0}</strong>clientes</p>
          <p><strong>{stats.month.stamps ?? 0}</strong>sellos este mes</p>
          <p><strong>{stats.month.rewardsRedeemed ?? 0}</strong>premios este mes</p>
        </div>
      )}
      <label>
        Buscar por nombre o teléfono
        <input type="search" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      {members?.length === 0 && <p>No hay ningún cliente así.</p>}
      {members?.map((m) => (
        <Link key={m.id} className="row" to={m.id}>
          <span>{m.name}</span>
          <span>
            {m.currentStamps} {m.currentStamps === 1 ? 'sello' : 'sellos'}
            {m.rewardsPending > 0 && ' · premio'}
          </span>
        </Link>
      ))}
      <Link className="link" to="/negocio">Volver</Link>
    </main>
  );
}
