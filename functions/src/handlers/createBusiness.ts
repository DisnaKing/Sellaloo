import { Timestamp } from 'firebase-admin/firestore';
import {
  COLLECTIONS,
  DEFAULT_DAILY_VISIT_LIMIT,
  DEFAULT_TIMEZONE,
  LEGAL_VERSION,
  MAX_STAMPS_REQUIRED,
  MIN_STAMPS_REQUIRED,
  PROGRAM_TEMPLATES,
  type BusinessDoc,
  type CreateBusinessResponse,
  type ProgramDoc,
} from '../shared/model.js';
import { asRecord, fail, requireUid, type HandlerDeps } from './common.js';

function text(value: unknown, max: number, what: string): string {
  const s = typeof value === 'string' ? value.trim() : '';
  if (s.length < 1 || s.length > max) fail('invalid-argument', 'invalid-argument', `Falta ${what}.`);
  return s;
}

/**
 * Crea el comercio y su programa. En el MVP hay un comercio por dueño: su id es el `uid` del
 * dueño, así la transacción no puede crear dos aunque lleguen dos llamadas a la vez.
 */
export async function handleCreateBusiness(
  { db, now }: HandlerDeps,
  authUid: string | undefined,
  data: unknown,
): Promise<CreateBusinessResponse> {
  const uid = requireUid(authUid);
  const req = asRecord(data);
  const name = text(req.name, 80, 'el nombre');
  const rewardDescription = text(req.rewardDescription, 80, 'el premio');
  if (!PROGRAM_TEMPLATES.some((t) => t.businessType === req.type)) {
    fail('invalid-argument', 'invalid-argument', 'Tipo de negocio no válido.');
  }
  const stampsRequired = req.stampsRequired;
  if (
    !Number.isInteger(stampsRequired) ||
    (stampsRequired as number) < MIN_STAMPS_REQUIRED ||
    (stampsRequired as number) > MAX_STAMPS_REQUIRED
  ) {
    fail('invalid-argument', 'invalid-argument', 'Número de sellos no válido.');
  }

  const ref = db.collection(COLLECTIONS.businesses).doc(uid);
  return db.runTransaction(async (tx) => {
    const owned = await tx.get(db.collection(COLLECTIONS.businesses).where('ownerUid', '==', uid).limit(1));
    if (!owned.empty) fail('already-exists', 'has-business', 'Ya tienes un comercio.');
    const createdAt = Timestamp.fromDate(now);
    tx.create(ref, {
      ownerUid: uid,
      name,
      type: req.type as string,
      logoUrl: null,
      timezone: DEFAULT_TIMEZONE,
      dailyVisitLimit: DEFAULT_DAILY_VISIT_LIMIT,
      plan: 'free',
      active: true,
      createdAt,
      firstStampAt: null,
      termsVersion: LEGAL_VERSION,
    } satisfies BusinessDoc);
    tx.create(ref.collection(COLLECTIONS.programs).doc(), {
      ownerUid: uid,
      stampsRequired: stampsRequired as number,
      rewardDescription,
      stampExpiryMonths: null,
      active: true,
      createdAt,
    } satisfies ProgramDoc);
    return { businessId: ref.id };
  });
}
