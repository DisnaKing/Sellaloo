import { Timestamp } from 'firebase-admin/firestore';
import {
  COLLECTIONS,
  type BusinessDoc,
  type CustomerDoc,
  type MemberDoc,
  type ProgramDoc,
  type QrTokenDoc,
  type RedeemQrResponse,
} from '../shared/model.js';
import { asRecord, fail, requireUid, type HandlerDeps } from './common.js';
import { stamp } from './stamp.js';
/** 32 bytes en base64url. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/**
 * Canjea un QR: en una sola transacción comprueba el token y el comercio, da los sellos
 * (ver `stamp`) y marca el token como usado para que el dueño lo vea al instante.
 */
export async function handleRedeemQr(
  { db, now }: HandlerDeps,
  authUid: string | undefined,
  data: unknown,
): Promise<RedeemQrResponse> {
  const uid = requireUid(authUid);
  const { token } = asRecord(data);
  if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) {
    fail('not-found', 'not-found', 'Este QR no es válido.');
  }

  const nowMs = now.getTime();
  const tokenRef = db.collection(COLLECTIONS.qrTokens).doc(token);

  return db.runTransaction(async (tx) => {
    // --- Lecturas (todas antes de cualquier escritura) ---
    const qr = (await tx.get(tokenRef)).data() as QrTokenDoc | undefined;
    if (!qr) fail('not-found', 'not-found', 'Este QR no es válido.');
    if (qr.usedAt) fail('failed-precondition', 'used', 'Este QR ya se ha usado.');
    if (qr.expiresAt.toMillis() <= nowMs) fail('failed-precondition', 'expired', 'Este QR ha caducado.');

    const businessRef = db.collection(COLLECTIONS.businesses).doc(qr.businessId);
    const memberRef = businessRef.collection(COLLECTIONS.members).doc(uid);
    const [businessSnap, programsSnap, memberSnap, customerSnap] = await Promise.all([
      tx.get(businessRef),
      tx.get(businessRef.collection(COLLECTIONS.programs).where('active', '==', true).limit(1)),
      tx.get(memberRef),
      tx.get(db.collection(COLLECTIONS.customers).doc(uid)),
    ]);
    const business = businessSnap.data() as BusinessDoc | undefined;
    const programSnap = programsSnap.docs[0];
    if (!business?.active || !programSnap) {
      fail('failed-precondition', 'business-inactive', 'Este comercio no está dando sellos ahora mismo.');
    }
    if (business.ownerUid === uid) fail('permission-denied', 'own-business', 'No puedes darte sellos a ti mismo.');
    const customer = customerSnap.data() as CustomerDoc | undefined;
    if (!customer) fail('failed-precondition', 'profile-required', 'Completa tu perfil para recibir el sello.');

    const program = programSnap.data() as ProgramDoc;
    const { result, visitId } = await stamp(db, tx, now, {
      businessId: qr.businessId,
      business,
      programId: programSnap.id,
      program,
      memberRef,
      member: memberSnap.data() as MemberDoc | undefined,
      holder: { customerId: uid, name: customer.name, phone: customer.phone, phoneVerified: customer.phoneVerified },
      amount: qr.amount,
      method: 'qr',
      qrToken: token,
      flowMs: nowMs - qr.createdAt.toMillis(),
    });

    tx.update(tokenRef, {
      usedAt: Timestamp.fromMillis(nowMs),
      usedByCustomerId: uid,
      usedByName: customer.name,
      visitId,
      result,
    });

    return {
      ...result,
      businessName: business.name,
      logoUrl: business.logoUrl,
      amount: qr.amount,
      reward: program.rewardDescription,
    };
  });
}
