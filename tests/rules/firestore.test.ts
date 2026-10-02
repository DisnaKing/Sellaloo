import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Firestore,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const OWNER = 'owner-1';
const MARIA = 'maria';
const PHONE = '+34600000001';

let env: RulesTestEnvironment;

function as(uid: string | null, claims: Record<string, unknown> = {}): Firestore {
  const ctx = uid ? env.authenticatedContext(uid, claims) : env.unauthenticatedContext();
  return ctx.firestore() as unknown as Firestore;
}

beforeAll(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
  env = await initializeTestEnvironment({
    projectId: 'demo-sellaloo',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  });
});

afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore;
    await setDoc(doc(db, 'businesses/cafe'), {
      ownerUid: OWNER, name: 'Café', type: 'cafeteria', logoUrl: null,
      timezone: 'Europe/Madrid', dailyVisitLimit: 1, plan: 'free', active: true,
    });
    await setDoc(doc(db, 'businesses/cafe/programs/p1'), {
      ownerUid: OWNER, stampsRequired: 10, rewardDescription: 'Un café', stampExpiryMonths: null, active: true,
    });
    await setDoc(doc(db, 'cards/c1'), { ownerUid: OWNER, customerId: MARIA, stamps: 3 });
    await setDoc(doc(db, 'qrTokens/t1'), { ownerUid: OWNER });
    await setDoc(doc(db, 'businesses/cafe/stats/total'), { ownerUid: OWNER, newMembers: 1 });
    await setDoc(doc(db, 'dailyVisits/d1'), { ownerUid: OWNER });
  });
});

describe('businesses', () => {
  it('solo el dueño o un admin lo leen', async () => {
    await assertSucceeds(getDoc(doc(as(OWNER), 'businesses/cafe')));
    await assertSucceeds(getDoc(doc(as('x', { admin: true }), 'businesses/cafe')));
    await assertFails(getDoc(doc(as('otro'), 'businesses/cafe')));
    await assertFails(getDoc(doc(as(null), 'businesses/cafe')));
  });

  it('el dueño cambia los datos básicos, pero no el plan ni active', async () => {
    const ref = doc(as(OWNER), 'businesses/cafe');
    await assertSucceeds(updateDoc(ref, { name: 'Café Nuevo', dailyVisitLimit: null }));
    await assertFails(updateDoc(ref, { plan: 'pro' }));
    await assertFails(updateDoc(ref, { active: false }));
    await assertFails(updateDoc(ref, { dailyVisitLimit: 0 }));
    await assertFails(updateDoc(doc(as('otro'), 'businesses/cafe'), { name: 'Robado' }));
  });

  it('un admin corrige los datos y lo desactiva, pero no cambia el plan', async () => {
    const ref = doc(as('x', { admin: true }), 'businesses/cafe');
    await assertSucceeds(updateDoc(ref, { name: 'Café Corregido', active: false }));
    await assertFails(updateDoc(ref, { active: 'no' }));
    await assertFails(updateDoc(ref, { plan: 'pro' }));
    await assertSucceeds(updateDoc(doc(as('x', { admin: true }), 'businesses/cafe/programs/p1'), { stampsRequired: 8 }));
  });
});

describe('programs', () => {
  it('el dueño cambia sellos, premio y caducidad, dentro de los límites', async () => {
    const ref = doc(as(OWNER), 'businesses/cafe/programs/p1');
    await assertSucceeds(updateDoc(ref, { stampsRequired: 8, rewardDescription: 'Un té', stampExpiryMonths: 6 }));
    await assertFails(updateDoc(ref, { stampsRequired: 1 }));
    await assertFails(updateDoc(ref, { stampExpiryMonths: 0 }));
    await assertFails(updateDoc(ref, { active: false }));
    await assertFails(updateDoc(doc(as('otro'), 'businesses/cafe/programs/p1'), { stampsRequired: 8 }));
  });
});

describe('customers', () => {
  const base = { name: 'María', email: null, privacyAcceptedAt: serverTimestamp(), createdAt: serverTimestamp() };

  it('crea su perfil con el teléfono verificado solo si entró por SMS con ese número', async () => {
    const sms = as(MARIA, { phone_number: PHONE });
    await assertSucceeds(setDoc(doc(sms, `customers/${MARIA}`), { ...base, phone: PHONE, phoneVerified: true }));
  });

  it('no puede marcar como verificado un teléfono que no es el suyo', async () => {
    const db = as(MARIA, { email: 'm@x.es' });
    await assertFails(setDoc(doc(db, `customers/${MARIA}`), { ...base, phone: PHONE, phoneVerified: true }));
    await assertSucceeds(setDoc(doc(db, `customers/${MARIA}`), { ...base, phone: PHONE, phoneVerified: false }));
  });

  it('no crea el perfil de otro', async () => {
    await assertFails(setDoc(doc(as('otro'), `customers/${MARIA}`), { ...base, phone: null, phoneVerified: false }));
  });
});

describe('cards', () => {
  it('las lee su cliente y el dueño, nadie más', async () => {
    await assertSucceeds(getDoc(doc(as(MARIA), 'cards/c1')));
    await assertSucceeds(getDoc(doc(as(OWNER), 'cards/c1')));
    await assertFails(getDoc(doc(as('otro'), 'cards/c1')));
  });

  it('la consulta del dueño tiene que filtrar por ownerUid', async () => {
    const db = as(OWNER);
    await assertSucceeds(getDocs(query(collection(db, 'cards'), where('ownerUid', '==', OWNER))));
    await assertFails(getDocs(collection(db, 'cards')));
  });

  it('nadie escribe tarjetas desde el cliente, ni el dueño', async () => {
    await assertFails(updateDoc(doc(as(OWNER), 'cards/c1'), { stamps: 10 }));
    await assertFails(updateDoc(doc(as(MARIA), 'cards/c1'), { stamps: 10 }));
  });
});

describe('stats', () => {
  it('el panel los pide con una consulta: el mes sin documento no la hace fallar', async () => {
    const stats = (uid: string) =>
      getDocs(query(collection(as(uid), 'businesses/cafe/stats'), where('ownerUid', '==', OWNER), where(documentId(), '>=', '2026-10')));
    await assertSucceeds(stats(OWNER));
    await assertFails(getDoc(doc(as(OWNER), 'businesses/cafe/stats/2026-10')));
    await assertFails(stats('otro'));
  });
});

describe('qrTokens y dailyVisits', () => {
  it('el QR lo lee el dueño, pero no lo escribe', async () => {
    await assertSucceeds(getDoc(doc(as(OWNER), 'qrTokens/t1')));
    await assertFails(getDoc(doc(as(MARIA), 'qrTokens/t1')));
    await assertFails(setDoc(doc(as(OWNER), 'qrTokens/t2'), { ownerUid: OWNER }));
  });

  it('dailyVisits solo lo lee un admin', async () => {
    await assertFails(getDoc(doc(as(OWNER), 'dailyVisits/d1')));
    await assertSucceeds(getDoc(doc(as('x', { admin: true }), 'dailyVisits/d1')));
  });
});
