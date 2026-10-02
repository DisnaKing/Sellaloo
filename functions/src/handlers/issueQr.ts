import { randomBytes } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import {
  COLLECTIONS,
  QR_AMOUNTS,
  QR_TTL_SECONDS,
  type BusinessDoc,
  type IssueQrResponse,
  type QrAmount,
} from '../shared/model.js';
import { asRecord, fail, isDocId, requireUid, type HandlerDeps } from './common.js';

/** Genera un QR de un solo uso con 1, 2 o 3 sellos. Solo lo puede pedir el dueño del comercio. */
export async function handleIssueQr(
  { db, now }: HandlerDeps,
  authUid: string | undefined,
  data: unknown,
): Promise<IssueQrResponse> {
  const uid = requireUid(authUid);
  const { businessId, amount } = parseRequest(data);

  const businessRef = db.collection(COLLECTIONS.businesses).doc(businessId);
  const [businessSnap, programsSnap] = await Promise.all([
    businessRef.get(),
    businessRef.collection(COLLECTIONS.programs).where('active', '==', true).limit(1).get(),
  ]);
  const business = businessSnap.data() as BusinessDoc | undefined;
  if (!business) fail('not-found', 'not-found', 'El comercio no existe.');
  if (business.ownerUid !== uid) fail('permission-denied', 'not-owner', 'Este comercio no es tuyo.');
  if (!business.active) fail('failed-precondition', 'business-inactive', 'El comercio está desactivado.');
  if (programsSnap.empty) fail('failed-precondition', 'no-program', 'El comercio no tiene una tarjeta activa.');

  const token = randomBytes(32).toString('base64url');
  const createdAt = now.getTime();
  const expiresAt = createdAt + QR_TTL_SECONDS * 1000;
  await db.collection(COLLECTIONS.qrTokens).doc(token).create({
    businessId,
    ownerUid: uid,
    amount,
    createdAt: Timestamp.fromMillis(createdAt),
    expiresAt: Timestamp.fromMillis(expiresAt),
    usedAt: null,
    usedByCustomerId: null,
    usedByName: null,
    visitId: null,
    result: null,
  });

  return { token, expiresAt, ttlSeconds: QR_TTL_SECONDS };
}

function parseRequest(data: unknown): { businessId: string; amount: QrAmount } {
  const { businessId, amount = 1 } = asRecord(data);
  if (!isDocId(businessId)) fail('invalid-argument', 'invalid-argument', 'Falta el comercio.');
  if (!QR_AMOUNTS.includes(amount as QrAmount)) {
    fail('invalid-argument', 'invalid-argument', 'El QR puede dar 1, 2 o 3 sellos.');
  }
  return { businessId, amount: amount as QrAmount };
}
