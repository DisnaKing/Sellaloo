import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { localDate } from '../domain/dates.js';
import { COLLECTIONS, DEFAULT_TIMEZONE, type BusinessDoc, type CardDoc } from '../shared/model.js';
import { asRecord, fail, isDocId, requireUid, type HandlerDeps } from './common.js';
import { addStats } from './stamp.js';

/** El dueño entrega el premio: la tarjeta pasa de `reward_pending` a `redeemed`. */
export async function handleRedeemReward(
  { db, now }: HandlerDeps,
  authUid: string | undefined,
  data: unknown,
): Promise<void> {
  const uid = requireUid(authUid);
  const { cardId } = asRecord(data);
  if (!isDocId(cardId)) fail('invalid-argument', 'invalid-argument', 'Falta la tarjeta.');

  await db.runTransaction(async (tx) => {
    const cardRef = db.collection(COLLECTIONS.cards).doc(cardId);
    const card = (await tx.get(cardRef)).data() as CardDoc | undefined;
    if (!card) fail('not-found', 'not-found', 'La tarjeta no existe.');
    if (card.ownerUid !== uid) fail('permission-denied', 'not-owner', 'Esta tarjeta no es de tu comercio.');
    if (card.status !== 'reward_pending') fail('failed-precondition', 'already-redeemed', 'Este premio ya se ha canjeado.');
    const businessRef = db.collection(COLLECTIONS.businesses).doc(card.businessId);
    const business = (await tx.get(businessRef)).data() as BusinessDoc;

    const nowTs = Timestamp.fromDate(now);
    tx.update(cardRef, { status: 'redeemed', redeemedAt: nowTs });
    tx.update(businessRef.collection(COLLECTIONS.members).doc(card.memberId), {
      rewardsPending: FieldValue.increment(-1),
    });
    addStats(tx, businessRef, localDate(now, business.timezone || DEFAULT_TIMEZONE), uid, nowTs, { rewardsRedeemed: 1 });
  });
}
