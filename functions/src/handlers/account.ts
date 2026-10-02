import { Timestamp, type DocumentReference, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { auth } from '../admin.js';
import {
  COLLECTIONS,
  type CardDoc,
  type ClaimPhoneCardsResponse,
  type CustomerDoc,
  type MemberDoc,
  toSearchName,
} from '../shared/model.js';
import { fail, requireUid, type HandlerDeps } from './common.js';

/** Nombre que queda en las fichas de quien borra su cuenta; el comercio conserva visitas y totales. */
export const DELETED_NAME = 'Cliente eliminado';

/**
 * Junta con la cuenta las fichas que los comercios crearon a mano con su teléfono. El teléfono sale
 * de Auth, así que solo vale uno verificado por SMS. En cada comercio la ficha manual pasa a ser
 * `members/{uid}`; si ya existía, se unen: los sellos de las dos tarjetas activas se suman.
 */
export async function handleClaimPhoneCards({ db, now }: HandlerDeps, authUid: string | undefined): Promise<ClaimPhoneCardsResponse> {
  const uid = requireUid(authUid);
  const phone = (await auth.getUser(uid)).phoneNumber;
  if (!phone) fail('failed-precondition', 'invalid-phone', 'Verifica tu teléfono primero.');
  const cards = db.collection(COLLECTIONS.cards);
  const visits = db.collection(COLLECTIONS.visits);

  // ponytail: una transacción admite 500 escrituras; una ficha manual con cientos de visitas no cabría.
  return db.runTransaction(async (tx) => {
    // --- Lecturas (todas antes de cualquier escritura) ---
    const customerRef = db.collection(COLLECTIONS.customers).doc(uid);
    const [customerSnap, manualSnap] = await Promise.all([
      tx.get(customerRef),
      tx.get(db.collectionGroup(COLLECTIONS.members).where('phone', '==', phone).where('customerId', '==', null)),
    ]);
    const customer = customerSnap.data() as CustomerDoc | undefined;
    if (!customer) fail('failed-precondition', 'profile-required', 'Completa tu perfil primero.');

    const merges = await Promise.all(
      manualSnap.docs.map(async (snap) => {
        const manual = snap.data() as MemberDoc;
        const targetRef = snap.ref.parent.doc(uid);
        const [targetSnap, cardsSnap, visitsSnap] = await Promise.all([
          tx.get(targetRef),
          tx.get(cards.where('businessId', '==', manual.businessId).where('memberId', '==', snap.id)),
          tx.get(visits.where('businessId', '==', manual.businessId).where('memberId', '==', snap.id)),
        ]);
        const target = targetSnap.data() as MemberDoc | undefined;
        const targetCardSnap = target?.activeCardId ? await tx.get(cards.doc(target.activeCardId)) : null;
        const targetCard = targetCardSnap?.data() as CardDoc | undefined;
        return {
          ref: snap.ref,
          manual,
          targetRef,
          target,
          targetCard: targetCard?.status === 'active' ? { ref: targetCardSnap!.ref, data: targetCard } : null,
          cards: cardsSnap.docs as QueryDocumentSnapshot<CardDoc>[],
          visits: visitsSnap.docs,
        };
      }),
    );

    // --- Escrituras ---
    const nowTs = Timestamp.fromDate(now);
    tx.update(customerRef, { phone, phoneVerified: true });
    for (const m of merges) {
      const { manual, target } = m;
      let activeCardId = target?.activeCardId ?? null;
      let currentStamps = target?.currentStamps ?? 0;
      let rewardsPending = (target?.rewardsPending ?? 0) + manual.rewardsPending;
      // Sellos que le quedan a la tarjeta activa de la ficha manual tras pasar a la de la cuenta.
      const restamped = new Map<DocumentReference, number>();
      const manualCard = m.cards.find((c) => c.id === manual.activeCardId && c.data().status === 'active');
      if (manualCard && !m.targetCard) {
        activeCardId = manualCard.id;
        currentStamps = manualCard.data().stamps;
      } else if (manualCard && m.targetCard) {
        // Cada tarjeta tiene menos sellos de los que pide, así que la suma completa una como mucho.
        // ponytail: no mira la caducidad de los sellos ni suma el premio a las estadísticas.
        const { ref, data } = m.targetCard;
        const total = data.stamps + manualCard.data().stamps;
        if (total < data.stampsRequired) {
          tx.update(ref, { stamps: total });
          // ponytail: si se deshace hoy la última visita de la ficha manual, su tarjeta ya no está.
          tx.delete(manualCard.ref);
          currentStamps = total;
        } else {
          tx.update(ref, { stamps: data.stampsRequired, status: 'reward_pending', completedAt: nowTs });
          restamped.set(manualCard.ref, total - data.stampsRequired);
          activeCardId = manualCard.id;
          currentStamps = total - data.stampsRequired;
          rewardsPending += 1;
        }
      }
      for (const card of m.cards) {
        if (card === manualCard && m.targetCard && !restamped.has(card.ref)) continue;
        const stamps = restamped.get(card.ref);
        tx.update(card.ref, { memberId: uid, customerId: uid, ...(stamps === undefined ? {} : { stamps }) });
      }
      for (const visit of m.visits) tx.update(visit.ref, { memberId: uid, customerId: uid });

      const times = [manual.lastVisitAt, target?.lastVisitAt].filter((t) => t != null);
      tx.set(m.targetRef, {
        ...manual,
        ...target,
        customerId: uid,
        name: customer.name,
        searchName: toSearchName(customer.name),
        phone,
        phoneVerified: true,
        currentStamps,
        rewardsPending,
        activeCardId,
        lastVisitAt: times.sort((a, b) => b.toMillis() - a.toMillis())[0] ?? null,
        createdAt: target && target.createdAt.toMillis() < manual.createdAt.toMillis() ? target.createdAt : manual.createdAt,
      } satisfies MemberDoc);
      // ponytail: el contador diario sigue con el id de la ficha manual; hoy podría colarse un sello más.
      tx.delete(m.ref);
    }
    return { claimed: merges.length };
  });
}

/**
 * Borra la cuenta del cliente (RGPD): su perfil y su usuario de Auth. Las fichas y tarjetas se quedan
 * en los comercios, sin nombre ni teléfono, para que no cambien sus totales.
 */
export async function handleDeleteAccount({ db }: HandlerDeps, authUid: string | undefined): Promise<void> {
  const uid = requireUid(authUid);
  const [owned, cardsSnap] = await Promise.all([
    db.collection(COLLECTIONS.businesses).where('ownerUid', '==', uid).limit(1).get(),
    db.collection(COLLECTIONS.cards).where('customerId', '==', uid).get(),
  ]);
  if (!owned.empty) fail('failed-precondition', 'has-business', 'Esta cuenta tiene un comercio.');

  // ponytail: un solo lote (500 escrituras); con más tarjetas, BulkWriter.
  const batch = db.batch();
  const businessIds = new Set<string>();
  for (const card of cardsSnap.docs) {
    batch.update(card.ref, { customerId: null, customerPhone: null });
    businessIds.add((card.data() as CardDoc).businessId);
  }
  // La ficha de un cliente con cuenta es `members/{uid}` en cada comercio donde tiene tarjeta.
  for (const businessId of businessIds) {
    const memberRef = db.collection(COLLECTIONS.businesses).doc(businessId).collection(COLLECTIONS.members).doc(uid);
    batch.set(
      memberRef,
      { customerId: null, name: DELETED_NAME, searchName: toSearchName(DELETED_NAME), phone: null, phoneVerified: false },
      { merge: true },
    );
  }
  batch.delete(db.collection(COLLECTIONS.customers).doc(uid));
  await batch.commit();
  await auth.deleteUser(uid);
}
