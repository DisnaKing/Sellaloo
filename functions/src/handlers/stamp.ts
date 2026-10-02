import {
  FieldValue,
  Timestamp,
  type DocumentReference,
  type Firestore,
  type Transaction,
} from 'firebase-admin/firestore';
import { addMonths, localDate } from '../domain/dates.js';
import { dailyVisitId, isOverDailyLimit } from '../domain/dailyLimit.js';
import { allocateStamps } from '../domain/stamps.js';
import {
  COLLECTIONS,
  DEFAULT_TIMEZONE,
  type BusinessDoc,
  type CardDoc,
  type DailyVisitDoc,
  type MemberDoc,
  type ProgramDoc,
  type StampResult,
  type VisitAllocation,
  type VisitMethod,
} from '../shared/model.js';
import { fail } from './common.js';

/** El contador diario solo hace falta durante el día local; la TTL lo borra después. */
const DAILY_VISIT_TTL_MS = 2 * 24 * 60 * 60 * 1000;

export interface StampInput {
  businessId: string;
  business: BusinessDoc;
  programId: string;
  program: ProgramDoc;
  memberRef: DocumentReference;
  member: MemberDoc | undefined;
  /** Quién recibe los sellos: se copia en la ficha y en las tarjetas nuevas. */
  holder: { customerId: string | null; name: string; phone: string | null; phoneVerified: boolean };
  amount: number;
  method: VisitMethod;
  qrToken: string | null;
  flowMs: number | null;
}

/** Lee y comprueba el comercio del dueño. Va dentro de la transacción, antes de cualquier escritura. */
export async function readOwnedBusiness(db: Firestore, tx: Transaction, uid: string, businessId: string) {
  const ref = db.collection(COLLECTIONS.businesses).doc(businessId);
  const business = (await tx.get(ref)).data() as BusinessDoc | undefined;
  if (!business) fail('not-found', 'not-found', 'El comercio no existe.');
  if (business.ownerUid !== uid) fail('permission-denied', 'not-owner', 'Este comercio no es tuyo.');
  return { ref, business };
}

/**
 * Da `amount` sellos dentro de la transacción: comprueba el límite diario, aplica la caducidad,
 * reparte los sellos (con sobrantes a una tarjeta nueva) y registra la visita y las estadísticas.
 * Hace sus lecturas primero; quien la llama no puede haber escrito antes y puede escribir después.
 */
export async function stamp(
  db: Firestore,
  tx: Transaction,
  now: Date,
  input: StampInput,
): Promise<{ result: StampResult; visitId: string }> {
  const { businessId, business, program, memberRef, member, holder, amount } = input;
  const nowTs = Timestamp.fromDate(now);
  const today = localDate(now, business.timezone || DEFAULT_TIMEZONE);
  const dailyRef = db.collection(COLLECTIONS.dailyVisits).doc(dailyVisitId(businessId, memberRef.id, today));
  const cardRef = member?.activeCardId ? db.collection(COLLECTIONS.cards).doc(member.activeCardId) : null;
  const [dailySnap, cardSnap] = await Promise.all([tx.get(dailyRef), cardRef ? tx.get(cardRef) : null]);

  const visitsToday = (dailySnap.data() as DailyVisitDoc | undefined)?.count ?? 0;
  if (isOverDailyLimit(visitsToday, business.dailyVisitLimit)) {
    fail('failed-precondition', 'daily-limit', 'Hoy ya ha recibido su sello en este comercio.');
  }

  // --- Reparto ---
  const cardData = cardSnap?.data() as CardDoc | undefined;
  const activeCard = cardRef && cardData?.status === 'active' ? { ref: cardRef, data: cardData } : null;
  // ponytail: al caducar, los sellos se pierden también si luego se deshace la visita.
  const expired = !!activeCard?.data.stampsExpireAt && activeCard.data.stampsExpireAt.toMillis() <= now.getTime();
  const currentStamps = expired ? 0 : (activeCard?.data.stamps ?? 0);
  const firstRequired = activeCard?.data.stampsRequired ?? program.stampsRequired;
  const { added, completed, activeStamps } = allocateStamps(currentStamps, firstRequired, amount, program.stampsRequired);
  const stampsExpireAt = program.stampExpiryMonths ? Timestamp.fromDate(addMonths(now, program.stampExpiryMonths)) : null;

  // --- Escrituras ---
  // `added[0]` va a la tarjeta activa (o a una nueva si no hay); cada sobrante abre otra tarjeta.
  const cards = db.collection(COLLECTIONS.cards);
  const allocations: VisitAllocation[] = [];
  let lastCardRef: DocumentReference = activeCard?.ref ?? cards.doc();
  added.forEach((count, i) => {
    const isLast = i === added.length - 1;
    const existing = i === 0 ? activeCard : null;
    const ref = i === 0 ? lastCardRef : cards.doc();
    const status = isLast ? 'active' : 'reward_pending';
    if (existing) {
      tx.update(ref, {
        stamps: currentStamps + count,
        status,
        lastStampAt: nowTs,
        completedAt: isLast ? null : nowTs,
        stampsExpireAt,
      });
    } else {
      tx.set(ref, {
        businessId,
        businessName: business.name,
        ownerUid: business.ownerUid,
        programId: input.programId,
        memberId: memberRef.id,
        customerId: holder.customerId,
        customerPhone: holder.phone,
        stamps: count,
        stampsRequired: i === 0 ? firstRequired : program.stampsRequired,
        reward: program.rewardDescription,
        status,
        createdAt: nowTs,
        lastStampAt: count > 0 ? nowTs : null,
        completedAt: isLast ? null : nowTs,
        redeemedAt: null,
        stampsExpireAt,
      } satisfies CardDoc);
    }
    allocations.push({ cardId: ref.id, count, created: !existing });
    lastCardRef = ref;
  });

  tx.set(
    memberRef,
    {
      ownerUid: business.ownerUid,
      businessId,
      customerId: holder.customerId,
      name: holder.name,
      phone: holder.phone,
      phoneVerified: holder.phoneVerified,
      currentStamps: activeStamps,
      rewardsPending: (member?.rewardsPending ?? 0) + completed,
      activeCardId: lastCardRef.id,
      lastVisitAt: nowTs,
      ...(member ? {} : { createdAt: nowTs }),
    },
    { merge: true },
  );

  const visitRef = db.collection(COLLECTIONS.visits).doc();
  tx.set(visitRef, {
    businessId,
    ownerUid: business.ownerUid,
    memberId: memberRef.id,
    customerId: holder.customerId,
    amount,
    method: input.method,
    localDate: today,
    allocations,
    qrToken: input.qrToken,
    flowMs: input.flowMs,
    createdAt: nowTs,
    undoneAt: null,
  });

  tx.set(dailyRef, {
    businessId,
    memberId: memberRef.id,
    localDate: today,
    count: visitsToday + 1,
    expiresAt: Timestamp.fromMillis(now.getTime() + DAILY_VISIT_TTL_MS),
  });

  addStats(tx, db.collection(COLLECTIONS.businesses).doc(businessId), today, business.ownerUid, nowTs, {
    visits: 1,
    [input.method === 'qr' ? 'qrVisits' : 'phoneVisits']: 1,
    stamps: amount,
    rewardsEarned: completed,
    newMembers: member ? 0 : 1,
    flowMsTotal: input.flowMs ?? 0,
  });

  return {
    result: {
      cardStamps: activeStamps,
      stampsRequired: added.length > 1 ? program.stampsRequired : firstRequired,
      rewardsEarned: completed,
    },
    visitId: visitRef.id,
  };
}

/** Suma (o resta, con valores negativos) en `stats/{AAAA-MM}` y `stats/total`. */
export function addStats(
  tx: Transaction,
  businessRef: DocumentReference,
  localDay: string,
  ownerUid: string,
  nowTs: Timestamp,
  deltas: Record<string, number>,
): void {
  const stats: Record<string, unknown> = { ownerUid, updatedAt: nowTs };
  for (const [key, value] of Object.entries(deltas)) stats[key] = FieldValue.increment(value);
  const col = businessRef.collection(COLLECTIONS.stats);
  tx.set(col.doc(localDay.slice(0, 7)), stats, { merge: true });
  tx.set(col.doc('total'), stats, { merge: true });
}
