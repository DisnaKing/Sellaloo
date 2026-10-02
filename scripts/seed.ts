// Datos de demo para los emuladores. Se puede lanzar varias veces: siempre deja el mismo estado.
// Uso: con `npm run emulators` en marcha, `npm run seed`.
import type { CreateRequest } from 'firebase-admin/auth';
import { Timestamp } from 'firebase-admin/firestore';
import {
  COLLECTIONS,
  DEFAULT_TIMEZONE,
  type BusinessDoc,
  type CardDoc,
  type CustomerDoc,
  type MemberDoc,
  type ProgramDoc,
} from '@shared/model.ts';
import { auth, db } from './emulator.ts';

const PASSWORD = 'sellaloo123';
const BUSINESS = 'demo-cafe';
const PROGRAM = 'demo-program';
const REWARD = 'Un café gratis';
const now = Timestamp.now();

async function upsertUser(uid: string, data: Omit<CreateRequest, 'uid'>, claims?: object): Promise<void> {
  try {
    await auth.updateUser(uid, data);
  } catch {
    await auth.createUser({ uid, ...data });
  }
  if (claims) await auth.setCustomUserClaims(uid, claims);
}

async function seedCustomer(uid: string, name: string, phone: string | null, email: string | null, stamps: number) {
  const customer: CustomerDoc = {
    name,
    email,
    phone,
    phoneVerified: phone !== null && email === null,
    privacyAcceptedAt: now,
    createdAt: now,
  };
  const cardId = `${uid}-card`;
  const card: CardDoc = {
    businessId: BUSINESS,
    businessName: 'Café Demo',
    ownerUid: 'demo-owner',
    programId: PROGRAM,
    memberId: uid,
    customerId: uid,
    customerPhone: phone,
    stamps,
    stampsRequired: 10,
    reward: REWARD,
    status: 'active',
    createdAt: now,
    lastStampAt: now,
    completedAt: null,
    redeemedAt: null,
    stampsExpireAt: null,
  };
  const member: MemberDoc = {
    ownerUid: 'demo-owner',
    businessId: BUSINESS,
    customerId: uid,
    name,
    phone,
    phoneVerified: customer.phoneVerified,
    currentStamps: stamps,
    rewardsPending: 0,
    activeCardId: cardId,
    lastVisitAt: now,
    createdAt: now,
  };
  await db.collection(COLLECTIONS.customers).doc(uid).set(customer);
  await db.collection(COLLECTIONS.cards).doc(cardId).set(card);
  await db.collection(COLLECTIONS.businesses).doc(BUSINESS).collection(COLLECTIONS.members).doc(uid).set(member);
}

await upsertUser('demo-owner', { email: 'dueno@demo.es', password: PASSWORD, displayName: 'Dueño Demo' });
await upsertUser('demo-admin', { email: 'admin@demo.es', password: PASSWORD }, { admin: true });
// Entra por SMS: el código aparece en la UI del emulador de Auth (http://127.0.0.1:4000/auth).
await upsertUser('demo-maria', { phoneNumber: '+34600000001', displayName: 'María' });
await upsertUser('demo-juan', { email: 'juan@demo.es', password: PASSWORD, displayName: 'Juan' });

const business: BusinessDoc = {
  ownerUid: 'demo-owner',
  name: 'Café Demo',
  type: 'cafeteria',
  logoUrl: null,
  timezone: DEFAULT_TIMEZONE,
  dailyVisitLimit: 1,
  plan: 'free',
  active: true,
  createdAt: now,
};
const program: ProgramDoc = {
  ownerUid: 'demo-owner',
  stampsRequired: 10,
  rewardDescription: REWARD,
  stampExpiryMonths: null,
  active: true,
  createdAt: now,
};
const businessRef = db.collection(COLLECTIONS.businesses).doc(BUSINESS);
await businessRef.set(business);
await businessRef.collection(COLLECTIONS.programs).doc(PROGRAM).set(program);

await seedCustomer('demo-maria', 'María', '+34600000001', null, 3);
await seedCustomer('demo-juan', 'Juan', null, 'juan@demo.es', 8);

console.log(`Seed listo. Contraseña de todas las cuentas de correo: ${PASSWORD}
  dueño:   dueno@demo.es
  admin:   admin@demo.es
  cliente: juan@demo.es (8 sellos)
  cliente: +34600000001 por SMS (3 sellos)`);
