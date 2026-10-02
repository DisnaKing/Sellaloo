import { beforeEach, describe, expect, it } from 'vitest';
import { auth } from '../src/admin.js';
import { handleIssueQr } from '../src/handlers/issueQr.js';
import { handleAddMember, handleStampByPhone } from '../src/handlers/phone.js';
import { handleRedeemQr } from '../src/handlers/redeemQr.js';
import { handleRedeemReward } from '../src/handlers/redeemReward.js';
import { handleUndoLastVisit } from '../src/handlers/undoLastVisit.js';
import { COLLECTIONS, type CardDoc, type DailyVisitDoc, type MemberDoc, type VisitDoc } from '../src/shared/model.js';
import {
  BUSINESS,
  MARIA,
  OWNER,
  T0,
  at,
  clearAuth,
  clearFirestore,
  db,
  getData,
  seedActiveCard,
  seedBusiness,
  seedCustomer,
} from './helpers.js';

const PEPE_PHONE = '+34611111111';
const member = (id: string) => getData<MemberDoc>(`${COLLECTIONS.businesses}/${BUSINESS}/${COLLECTIONS.members}/${id}`);
const card = (id: string) => getData<CardDoc>(`${COLLECTIONS.cards}/${id}`);
const stats = (doc: string) =>
  getData<Record<string, number>>(`${COLLECTIONS.businesses}/${BUSINESS}/${COLLECTIONS.stats}/${doc}`);
const reason = (r: string) => ({ details: { reason: r } });
const undo = (seconds: number) => handleUndoLastVisit(at(T0, seconds), OWNER, { businessId: BUSINESS });

function addPepe() {
  return handleAddMember(at(T0, 0), OWNER, { businessId: BUSINESS, name: ' Pepe ', phone: '611 11 11 11' });
}

function stampPhone(phone: string, amount = 1, seconds = 0) {
  return handleStampByPhone(at(T0, seconds), OWNER, { businessId: BUSINESS, phone, amount });
}

/** María llega con 9 de 10 sellos y escanea un QR de `amount`: completa la tarjeta. */
async function mariaCompletesCard(amount = 1): Promise<string> {
  const cardId = await seedActiveCard(MARIA, 'María', 9);
  const { token } = await handleIssueQr(at(T0, 0), OWNER, { businessId: BUSINESS, amount });
  await handleRedeemQr(at(T0, 5), MARIA, { token });
  return cardId;
}

beforeEach(async () => {
  await clearFirestore();
  await clearAuth();
  await seedBusiness();
  await seedCustomer(MARIA, 'María');
});

describe('addMember', () => {
  it('da de alta un cliente sin cuenta con el teléfono normalizado', async () => {
    const { memberId, phone } = await addPepe();
    expect(phone).toBe(PEPE_PHONE);
    expect(await member(memberId)).toMatchObject({
      name: 'Pepe',
      searchName: 'pepe',
      customerId: null,
      phoneVerified: false,
      ownerUid: OWNER,
    });
    expect(await stats('total')).toMatchObject({ newMembers: 1, phoneSignups: 1 });
  });

  it('no repite teléfono ni acepta uno inválido', async () => {
    await addPepe();
    await expect(addPepe()).rejects.toMatchObject(reason('phone-taken'));
    await expect(
      handleAddMember(at(T0, 0), OWNER, { businessId: BUSINESS, name: 'X', phone: '123' }),
    ).rejects.toMatchObject(reason('invalid-phone'));
  });

  it('solo lo hace el dueño', async () => {
    await expect(
      handleAddMember(at(T0, 0), MARIA, { businessId: BUSINESS, name: 'X', phone: PEPE_PHONE }),
    ).rejects.toMatchObject(reason('not-owner'));
  });
});

describe('stampByPhone', () => {
  it('sella a un cliente dado de alta a mano', async () => {
    const { memberId } = await addPepe();
    const res = await stampPhone(PEPE_PHONE, 2);
    expect(res).toMatchObject({ memberId, name: 'Pepe', cardStamps: 2, rewardsEarned: 0 });
    const m = await member(memberId);
    expect(await card(m!.activeCardId!)).toMatchObject({ customerId: null, customerPhone: PEPE_PHONE, stamps: 2 });
    expect(await stats('total')).toMatchObject({ visits: 1, phoneVisits: 1, stamps: 2, newMembers: 1 });
  });

  it('usa la cuenta con ese teléfono verificado', async () => {
    await auth.createUser({ uid: MARIA, phoneNumber: '+34600000000' });
    const res = await stampPhone('600000000');
    expect(res).toMatchObject({ memberId: MARIA, name: 'María', cardStamps: 1 });
    expect(await member(MARIA)).toMatchObject({ customerId: MARIA, phoneVerified: true });
  });

  it('avisa si el teléfono no es de ningún cliente', async () => {
    await expect(stampPhone(PEPE_PHONE)).rejects.toMatchObject({ code: 'not-found', ...reason('unknown-phone') });
  });

  it('respeta el límite diario', async () => {
    await addPepe();
    await stampPhone(PEPE_PHONE);
    await expect(stampPhone(PEPE_PHONE, 1, 60)).rejects.toMatchObject(reason('daily-limit'));
  });
});

describe('undoLastVisit', () => {
  it('quita los sellos, borra la tarjeta nueva y libera el límite diario', async () => {
    const cardId = await mariaCompletesCard(3);
    const { activeCardId } = (await member(MARIA))!;
    expect(activeCardId).not.toBe(cardId);

    expect(await undo(30)).toEqual({ name: 'María', amount: 3 });

    expect(await card(cardId)).toMatchObject({ stamps: 9, status: 'active', completedAt: null });
    expect(await card(activeCardId!)).toBeUndefined();
    expect(await member(MARIA)).toMatchObject({ currentStamps: 9, activeCardId: cardId, rewardsPending: 0 });
    const daily = await db.collection(COLLECTIONS.dailyVisits).get();
    expect((daily.docs[0]!.data() as DailyVisitDoc).count).toBe(0);
    expect(await stats('total')).toMatchObject({ visits: 0, qrVisits: 0, stamps: 0, rewardsEarned: 0, flowMsTotal: 0 });
    const visit = (await db.collection(COLLECTIONS.visits).get()).docs[0]!.data() as VisitDoc;
    expect(visit.undoneAt).not.toBeNull();

    // No se deshace dos veces, y María puede volver a sellar hoy.
    await expect(undo(40)).rejects.toMatchObject(reason('nothing-to-undo'));
    const { token } = await handleIssueQr(at(T0, 50), OWNER, { businessId: BUSINESS });
    await expect(handleRedeemQr(at(T0, 55), MARIA, { token })).resolves.toMatchObject({ rewardsEarned: 1 });
  });

  it('deja la ficha sin tarjeta si la visita creó la primera', async () => {
    const { memberId } = await addPepe();
    await stampPhone(PEPE_PHONE);
    await undo(10);
    expect(await member(memberId)).toMatchObject({ currentStamps: 0, activeCardId: null });
    expect((await db.collection(COLLECTIONS.cards).get()).empty).toBe(true);
  });

  it('solo deshace visitas de hoy', async () => {
    await addPepe();
    await stampPhone(PEPE_PHONE);
    await expect(undo(86_400)).rejects.toMatchObject(reason('undo-expired'));
  });

  it('no deshace si el premio ya se ha canjeado', async () => {
    const cardId = await mariaCompletesCard();
    await handleRedeemReward(at(T0, 10), OWNER, { cardId });
    await expect(undo(20)).rejects.toMatchObject(reason('already-redeemed'));
  });
});

describe('redeemReward', () => {
  it('canjea el premio una sola vez', async () => {
    const cardId = await mariaCompletesCard();
    expect(await card(cardId)).toMatchObject({ status: 'reward_pending' });

    await expect(handleRedeemReward(at(T0, 10), MARIA, { cardId })).rejects.toMatchObject(reason('not-owner'));
    await handleRedeemReward(at(T0, 10), OWNER, { cardId });
    expect(await card(cardId)).toMatchObject({ status: 'redeemed' });
    expect(await member(MARIA)).toMatchObject({ rewardsPending: 0 });
    expect(await stats('total')).toMatchObject({ rewardsEarned: 1, rewardsRedeemed: 1 });
    await expect(handleRedeemReward(at(T0, 20), OWNER, { cardId })).rejects.toMatchObject(reason('already-redeemed'));
  });
});

describe('caducidad de los sellos', () => {
  it('pone a cero los sellos caducados antes de sumar', async () => {
    await seedBusiness({ stampExpiryMonths: 1 });
    await addPepe();
    const first = await stampPhone(PEPE_PHONE, 3);
    const { activeCardId } = (await member(first.memberId))!;
    expect((await card(activeCardId!))?.stampsExpireAt?.toMillis()).toBe(Date.UTC(2026, 10, 1, 10));

    expect((await stampPhone(PEPE_PHONE, 1, 32 * 86_400)).cardStamps).toBe(1);
  });
});
