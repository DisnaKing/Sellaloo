import { FieldValue, Timestamp, type DocumentReference } from 'firebase-admin/firestore';
import { localDate } from '../domain/dates.js';
import { dailyVisitId, isOverDailyLimit } from '../domain/dailyLimit.js';
import { allocateStamps } from '../domain/stamps.js';
import {
  COLLECTIONS,
  DEFAULT_TIMEZONE,
  type BusinessDoc,
  type CardDoc,
  type CustomerDoc,
  type DailyVisitDoc,
  type MemberDoc,
  type ProgramDoc,
  type QrTokenDoc,
  type RedeemQrResponse,
  type StampResult,
  type VisitAllocation,
} from '../shared/model.js';
import { asRecord, fail, requireUid, type HandlerDeps } from './common.js';

/** El contador diario solo hace falta durante el día local; la TTL lo borra después. */
const DAILY_VISIT_TTL_MS = 2 * 24 * 60 * 60 * 1000;
/** 32 bytes en base64url. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/**
 * Canjea un QR: en una sola transacción comprueba el token, el comercio y el límite diario,
 * reparte los sellos (con sobrantes a una tarjeta nueva) y deja constancia de la visita.
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
  const nowTs = Timestamp.fromMillis(nowMs);
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
    const member = memberSnap.data() as MemberDoc | undefined;
    const today = localDate(now, business.timezone || DEFAULT_TIMEZONE);
    const dailyRef = db.collection(COLLECTIONS.dailyVisits).doc(dailyVisitId(qr.businessId, uid, today));
    const cardRef = member?.activeCardId ? db.collection(COLLECTIONS.cards).doc(member.activeCardId) : null;
    const [dailySnap, cardSnap] = await Promise.all([tx.get(dailyRef), cardRef ? tx.get(cardRef) : null]);

    const visitsToday = (dailySnap.data() as DailyVisitDoc | undefined)?.count ?? 0;
    if (isOverDailyLimit(visitsToday, business.dailyVisitLimit)) {
      fail('failed-precondition', 'daily-limit', 'Hoy ya has recibido tu sello en este comercio.');
    }

    // --- Reparto ---
    const cardData = cardSnap?.data() as CardDoc | undefined;
    const activeCard = cardRef && cardData?.status === 'active' ? { ref: cardRef, data: cardData } : null;
    const firstRequired = activeCard?.data.stampsRequired ?? program.stampsRequired;
    const { added, completed, activeStamps } = allocateStamps(
      activeCard?.data.stamps ?? 0,
      firstRequired,
      qr.amount,
      program.stampsRequired,
    );

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
          stamps: existing.data.stamps + count,
          status,
          lastStampAt: nowTs,
          completedAt: isLast ? null : nowTs,
        });
      } else {
        tx.set(ref, {
          businessId: qr.businessId,
          businessName: business.name,
          ownerUid: business.ownerUid,
          programId: programSnap.id,
          memberId: uid,
          customerId: uid,
          customerPhone: customer.phone,
          stamps: count,
          stampsRequired: i === 0 ? firstRequired : program.stampsRequired,
          reward: program.rewardDescription,
          status,
          createdAt: nowTs,
          lastStampAt: count > 0 ? nowTs : null,
          completedAt: isLast ? null : nowTs,
          redeemedAt: null,
        });
      }
      allocations.push({ cardId: ref.id, count, created: !existing });
      lastCardRef = ref;
    });

    tx.set(
      memberRef,
      {
        ownerUid: business.ownerUid,
        businessId: qr.businessId,
        customerId: uid,
        name: customer.name,
        phone: customer.phone,
        phoneVerified: customer.phoneVerified,
        currentStamps: activeStamps,
        rewardsPending: (member?.rewardsPending ?? 0) + completed,
        activeCardId: lastCardRef.id,
        lastVisitAt: nowTs,
        ...(member ? {} : { createdAt: nowTs }),
      },
      { merge: true },
    );

    const flowMs = nowMs - qr.createdAt.toMillis();
    const visitRef = db.collection(COLLECTIONS.visits).doc();
    tx.set(visitRef, {
      businessId: qr.businessId,
      ownerUid: business.ownerUid,
      memberId: uid,
      customerId: uid,
      amount: qr.amount,
      method: 'qr',
      localDate: today,
      allocations,
      qrToken: token,
      flowMs,
      createdAt: nowTs,
      undoneAt: null,
    });

    const result: StampResult = {
      cardStamps: activeStamps,
      stampsRequired: added.length > 1 ? program.stampsRequired : firstRequired,
      rewardsEarned: completed,
    };
    tx.update(tokenRef, {
      usedAt: nowTs,
      usedByCustomerId: uid,
      usedByName: customer.name,
      visitId: visitRef.id,
      result,
    });

    tx.set(dailyRef, {
      businessId: qr.businessId,
      memberId: uid,
      localDate: today,
      count: visitsToday + 1,
      expiresAt: Timestamp.fromMillis(nowMs + DAILY_VISIT_TTL_MS),
    });

    const stats = {
      ownerUid: business.ownerUid,
      visits: FieldValue.increment(1),
      qrVisits: FieldValue.increment(1),
      stamps: FieldValue.increment(qr.amount),
      rewardsEarned: FieldValue.increment(completed),
      newMembers: FieldValue.increment(member ? 0 : 1),
      flowMsTotal: FieldValue.increment(flowMs),
      updatedAt: nowTs,
    };
    const statsCol = businessRef.collection(COLLECTIONS.stats);
    tx.set(statsCol.doc(today.slice(0, 7)), stats, { merge: true });
    tx.set(statsCol.doc('total'), stats, { merge: true });

    return { ...result, businessName: business.name, amount: qr.amount, reward: program.rewardDescription };
  });
}
