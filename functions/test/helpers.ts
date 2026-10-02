import { Timestamp } from 'firebase-admin/firestore';
import { db } from '../src/admin.js';
import type { HandlerDeps } from '../src/handlers/common.js';
import {
  COLLECTIONS,
  DEFAULT_TIMEZONE,
  type BusinessDoc,
  type CardDoc,
  type CustomerDoc,
  type MemberDoc,
  type ProgramDoc,
  toSearchName,
} from '../src/shared/model.js';

export { db };

export const OWNER = 'owner-1';
export const BUSINESS = 'cafe';
export const PROGRAM = 'program-1';
export const MARIA = 'maria';
export const JUAN = 'juan';

/** Jueves 1 de octubre de 2026, 12:00 en Madrid. */
export const T0 = new Date('2026-10-01T10:00:00Z');

export function at(base: Date, seconds: number): HandlerDeps {
  return { db, now: new Date(base.getTime() + seconds * 1000) };
}

export async function clearFirestore(): Promise<void> {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  const project = process.env.GCLOUD_PROJECT;
  const res = await fetch(
    `http://${host}/emulator/v1/projects/${project}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  if (!res.ok) throw new Error(`No se pudo vaciar el emulador: ${res.status}`);
}

export async function clearAuth(): Promise<void> {
  const res = await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${process.env.GCLOUD_PROJECT}/accounts`,
    { method: 'DELETE' },
  );
  if (!res.ok) throw new Error(`No se pudo vaciar Auth: ${res.status}`);
}

interface BusinessOptions {
  id?: string;
  active?: boolean;
  dailyVisitLimit?: number | null;
  stampsRequired?: number;
  stampExpiryMonths?: number | null;
}

export async function seedBusiness({
  id = BUSINESS,
  active = true,
  dailyVisitLimit = 1,
  stampsRequired = 10,
  stampExpiryMonths = null,
}: BusinessOptions = {}): Promise<void> {
  const createdAt = Timestamp.fromDate(T0);
  const business: BusinessDoc = {
    ownerUid: OWNER,
    name: 'Café Demo',
    type: 'cafeteria',
    logoUrl: null,
    timezone: DEFAULT_TIMEZONE,
    dailyVisitLimit,
    plan: 'free',
    active,
    createdAt,
    firstStampAt: null,
  };
  const program: ProgramDoc = {
    ownerUid: OWNER,
    stampsRequired,
    rewardDescription: 'Un café gratis',
    stampExpiryMonths,
    active: true,
    createdAt,
  };
  const ref = db.collection(COLLECTIONS.businesses).doc(id);
  await ref.set(business);
  await ref.collection(COLLECTIONS.programs).doc(PROGRAM).set(program);
}

export async function seedCustomer(uid: string, name: string): Promise<void> {
  const customer: CustomerDoc = {
    name,
    email: null,
    phone: '+34600000000',
    phoneVerified: true,
    privacyAcceptedAt: Timestamp.fromDate(T0),
    createdAt: Timestamp.fromDate(T0),
  };
  await db.collection(COLLECTIONS.customers).doc(uid).set(customer);
}

/** Deja al cliente con una tarjeta activa de `stamps` sellos, como si ya hubiera venido antes. */
export async function seedActiveCard(uid: string, name: string, stamps: number, stampsRequired = 10): Promise<string> {
  const ts = Timestamp.fromDate(T0);
  const cardRef = db.collection(COLLECTIONS.cards).doc();
  const card: CardDoc = {
    businessId: BUSINESS,
    businessName: 'Café Demo',
    ownerUid: OWNER,
    programId: PROGRAM,
    memberId: uid,
    customerId: uid,
    customerPhone: '+34600000000',
    stamps,
    stampsRequired,
    reward: 'Un café gratis',
    status: 'active',
    createdAt: ts,
    lastStampAt: ts,
    completedAt: null,
    redeemedAt: null,
    stampsExpireAt: null,
  };
  const member: MemberDoc = {
    ownerUid: OWNER,
    businessId: BUSINESS,
    customerId: uid,
    name,
    searchName: toSearchName(name),
    phone: '+34600000000',
    phoneVerified: true,
    currentStamps: stamps,
    rewardsPending: 0,
    activeCardId: cardRef.id,
    lastVisitAt: ts,
    createdAt: ts,
  };
  await cardRef.set(card);
  await db.collection(COLLECTIONS.businesses).doc(BUSINESS).collection(COLLECTIONS.members).doc(uid).set(member);
  return cardRef.id;
}

export async function getData<T>(path: string): Promise<T | undefined> {
  return (await db.doc(path).get()).data() as T | undefined;
}
