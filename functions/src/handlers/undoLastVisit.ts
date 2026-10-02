import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { dailyVisitId } from '../domain/dailyLimit.js';
import { localDate } from '../domain/dates.js';
import {
  COLLECTIONS,
  DEFAULT_TIMEZONE,
  type CardDoc,
  type MemberDoc,
  type UndoLastVisitResponse,
  type VisitDoc,
} from '../shared/model.js';
import { asRecord, fail, isDocId, requireUid, type HandlerDeps } from './common.js';
import { addStats, readOwnedBusiness } from './stamp.js';

/**
 * Deshace la última visita del comercio, solo si es de hoy y su premio no se ha canjeado:
 * resta los sellos, borra las tarjetas que creó y descuenta el límite diario y las estadísticas.
 */
export async function handleUndoLastVisit(
  { db, now }: HandlerDeps,
  authUid: string | undefined,
  data: unknown,
): Promise<UndoLastVisitResponse> {
  const uid = requireUid(authUid);
  const { businessId } = asRecord(data);
  if (!isDocId(businessId)) fail('invalid-argument', 'invalid-argument', 'Falta el comercio.');

  return db.runTransaction(async (tx) => {
    const { ref, business } = await readOwnedBusiness(db, tx, uid, businessId);
    const last = await tx.get(
      db.collection(COLLECTIONS.visits).where('businessId', '==', businessId).orderBy('createdAt', 'desc').limit(1),
    );
    const visitSnap = last.docs[0];
    const visit = visitSnap?.data() as VisitDoc | undefined;
    if (!visitSnap || !visit || visit.undoneAt) fail('failed-precondition', 'nothing-to-undo', 'No hay ninguna visita que deshacer.');
    if (visit.localDate !== localDate(now, business.timezone || DEFAULT_TIMEZONE)) {
      fail('failed-precondition', 'undo-expired', 'Solo se puede deshacer una visita de hoy.');
    }

    const cards = db.collection(COLLECTIONS.cards);
    const memberRef = ref.collection(COLLECTIONS.members).doc(visit.memberId);
    const [memberSnap, ...cardSnaps] = await Promise.all([
      tx.get(memberRef),
      ...visit.allocations.map((a) => tx.get(cards.doc(a.cardId))),
    ]);
    const cardData = cardSnaps.map((s) => s.data() as CardDoc | undefined);
    if (cardData.some((c) => c?.status === 'redeemed')) {
      fail('failed-precondition', 'already-redeemed', 'El premio de esa visita ya se ha canjeado.');
    }

    // Solo la primera tarjeta existía antes de la visita; las que se crearon en ella se borran enteras.
    const [first] = visit.allocations;
    const firstCard = cardData[0];
    const restored = first && !first.created && firstCard ? firstCard.stamps - first.count : null;
    visit.allocations.forEach((a) => {
      if (a.created) tx.delete(cards.doc(a.cardId));
    });
    if (first && restored !== null) {
      tx.update(cards.doc(first.cardId), { stamps: restored, status: 'active', completedAt: null });
    }

    const completed = visit.allocations.length - 1;
    const member = memberSnap.data() as MemberDoc;
    const nowTs = Timestamp.fromDate(now);
    tx.update(memberRef, {
      currentStamps: restored ?? 0,
      activeCardId: restored === null ? null : first!.cardId,
      rewardsPending: FieldValue.increment(-completed),
    });
    tx.update(visitSnap.ref, { undoneAt: nowTs });
    tx.update(db.collection(COLLECTIONS.dailyVisits).doc(dailyVisitId(businessId, visit.memberId, visit.localDate)), {
      count: FieldValue.increment(-1),
    });
    addStats(tx, ref, visit.localDate, uid, nowTs, {
      visits: -1,
      [visit.method === 'qr' ? 'qrVisits' : 'phoneVisits']: -1,
      stamps: -visit.amount,
      rewardsEarned: -completed,
      flowMsTotal: -(visit.flowMs ?? 0),
    });
    return { name: member.name, amount: visit.amount };
  });
}
