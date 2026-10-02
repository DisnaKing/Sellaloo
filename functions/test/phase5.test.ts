import { beforeEach, describe, expect, it } from 'vitest';
import { auth } from '../src/admin.js';
import { DELETED_NAME, handleClaimPhoneCards, handleDeleteAccount } from '../src/handlers/account.js';
import { handleAddMember, handleStampByPhone } from '../src/handlers/phone.js';
import { COLLECTIONS, type CardDoc, type MemberDoc, type VisitDoc } from '../src/shared/model.js';
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
const reason = (r: string) => ({ details: { reason: r } });
const claim = (uid: string) => handleClaimPhoneCards(at(T0, 60), uid);

/** El dueño da de alta a mano a alguien con el teléfono de Pepe y le pone `amount` sellos. */
async function manualMember(amount: 1 | 2 | 3) {
  const { memberId } = await handleAddMember(at(T0, 0), OWNER, { businessId: BUSINESS, name: 'Pepe', phone: PEPE_PHONE });
  await handleStampByPhone(at(T0, 0), OWNER, { businessId: BUSINESS, phone: PEPE_PHONE, amount });
  return { memberId, cardId: (await member(memberId))!.activeCardId! };
}

beforeEach(async () => {
  await clearFirestore();
  await clearAuth();
  await seedBusiness();
  await seedCustomer(MARIA, 'María');
});

describe('claimPhoneCards', () => {
  it('pasa la ficha manual a la cuenta con su tarjeta y sus visitas', async () => {
    const { memberId, cardId } = await manualMember(2);
    await auth.createUser({ uid: MARIA, phoneNumber: PEPE_PHONE });

    expect(await claim(MARIA)).toEqual({ claimed: 1 });
    expect(await member(memberId)).toBeUndefined();
    expect(await member(MARIA)).toMatchObject({ customerId: MARIA, name: 'María', currentStamps: 2, activeCardId: cardId });
    expect(await card(cardId)).toMatchObject({ memberId: MARIA, customerId: MARIA, stamps: 2 });
    const visits = await db.collection(COLLECTIONS.visits).where('businessId', '==', BUSINESS).get();
    expect(visits.docs.map((d) => (d.data() as VisitDoc).memberId)).toEqual([MARIA]);
    expect(await getData(`${COLLECTIONS.customers}/${MARIA}`)).toMatchObject({ phone: PEPE_PHONE, phoneVerified: true });
  });

  it('suma los sellos a la tarjeta que ya tenía', async () => {
    const own = await seedActiveCard(MARIA, 'María', 5);
    const { cardId } = await manualMember(3);
    await auth.createUser({ uid: MARIA, phoneNumber: PEPE_PHONE });

    await claim(MARIA);
    expect(await card(own)).toMatchObject({ stamps: 8, status: 'active' });
    expect(await card(cardId)).toBeUndefined();
    expect(await member(MARIA)).toMatchObject({ currentStamps: 8, activeCardId: own });
  });

  it('si la suma llena la tarjeta, queda el premio y el resto en la otra', async () => {
    const own = await seedActiveCard(MARIA, 'María', 9);
    const { cardId } = await manualMember(3);
    await auth.createUser({ uid: MARIA, phoneNumber: PEPE_PHONE });

    await claim(MARIA);
    expect(await card(own)).toMatchObject({ stamps: 10, status: 'reward_pending' });
    expect(await card(cardId)).toMatchObject({ stamps: 2, status: 'active', customerId: MARIA });
    expect(await member(MARIA)).toMatchObject({ currentStamps: 2, rewardsPending: 1, activeCardId: cardId });
  });

  it('no toca las fichas de otro teléfono', async () => {
    const { memberId } = await manualMember(1);
    await auth.createUser({ uid: MARIA, phoneNumber: '+34622222222' });

    expect(await claim(MARIA)).toEqual({ claimed: 0 });
    expect(await member(memberId)).toMatchObject({ customerId: null });
  });

  it('exige un teléfono verificado en la cuenta', async () => {
    await manualMember(1);
    await auth.createUser({ uid: MARIA, email: 'maria@demo.es' });
    await expect(claim(MARIA)).rejects.toMatchObject(reason('invalid-phone'));
  });
});

describe('deleteAccount', () => {
  it('borra perfil y usuario y deja la ficha anónima en el comercio', async () => {
    const cardId = await seedActiveCard(MARIA, 'María', 4);
    await auth.createUser({ uid: MARIA });

    await handleDeleteAccount(at(T0, 0), MARIA);
    expect(await getData(`${COLLECTIONS.customers}/${MARIA}`)).toBeUndefined();
    expect(await card(cardId)).toMatchObject({ customerId: null, customerPhone: null, stamps: 4 });
    expect(await member(MARIA)).toMatchObject({ customerId: null, name: DELETED_NAME, phone: null, currentStamps: 4 });
    await expect(auth.getUser(MARIA)).rejects.toThrow();
  });

  it('no borra la cuenta de un comercio', async () => {
    await expect(handleDeleteAccount(at(T0, 0), OWNER)).rejects.toMatchObject(reason('has-business'));
  });
});
