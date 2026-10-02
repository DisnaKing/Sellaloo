import { beforeEach, describe, expect, it } from 'vitest';
import { handleIssueQr } from '../src/handlers/issueQr.js';
import { handleRedeemQr } from '../src/handlers/redeemQr.js';
import {
  COLLECTIONS,
  type CardDoc,
  type MemberDoc,
  type QrTokenDoc,
  type VisitDoc,
} from '../src/shared/model.js';
import {
  BUSINESS,
  JUAN,
  MARIA,
  OWNER,
  T0,
  at,
  clearFirestore,
  db,
  getData,
  seedActiveCard,
  seedBusiness,
  seedCustomer,
} from './helpers.js';

function reason(r: string) {
  return { details: { reason: r } };
}

async function issue(base = T0, amount = 1): Promise<string> {
  const { token } = await handleIssueQr(at(base, 0), OWNER, { businessId: BUSINESS, amount });
  return token;
}

async function visitsCount(): Promise<number> {
  return (await db.collection(COLLECTIONS.visits).count().get()).data().count;
}

beforeEach(async () => {
  await clearFirestore();
  await seedBusiness();
  await seedCustomer(MARIA, 'María');
  await seedCustomer(JUAN, 'Juan');
});

describe('issueQr', () => {
  it('crea un token de un solo uso que caduca a los 150 s', async () => {
    const res = await handleIssueQr(at(T0, 0), OWNER, { businessId: BUSINESS, amount: 2 });

    expect(res.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(res.ttlSeconds).toBe(150);
    expect(res.expiresAt).toBe(T0.getTime() + 150_000);
    const qr = await getData<QrTokenDoc>(`${COLLECTIONS.qrTokens}/${res.token}`);
    expect(qr).toMatchObject({ businessId: BUSINESS, ownerUid: OWNER, amount: 2, usedAt: null });
  });

  it('da 1 sello si no se indica la cantidad', async () => {
    const { token } = await handleIssueQr(at(T0, 0), OWNER, { businessId: BUSINESS });
    expect((await getData<QrTokenDoc>(`${COLLECTIONS.qrTokens}/${token}`))?.amount).toBe(1);
  });

  it('pide sesión', async () => {
    await expect(handleIssueQr(at(T0, 0), undefined, { businessId: BUSINESS })).rejects.toMatchObject({
      code: 'unauthenticated',
      ...reason('unauthenticated'),
    });
  });

  it('solo lo puede pedir el dueño', async () => {
    await expect(handleIssueQr(at(T0, 0), MARIA, { businessId: BUSINESS })).rejects.toMatchObject({
      code: 'permission-denied',
      ...reason('not-owner'),
    });
  });

  it('rechaza un comercio desactivado', async () => {
    await seedBusiness({ active: false });
    await expect(handleIssueQr(at(T0, 0), OWNER, { businessId: BUSINESS })).rejects.toMatchObject(
      reason('business-inactive'),
    );
  });

  it('rechaza cantidades que no sean 1, 2 o 3', async () => {
    for (const amount of [0, 4, 1.5, '2']) {
      await expect(handleIssueQr(at(T0, 0), OWNER, { businessId: BUSINESS, amount })).rejects.toMatchObject({
        code: 'invalid-argument',
      });
    }
  });

  it('rechaza un comercio que no existe', async () => {
    await expect(handleIssueQr(at(T0, 0), OWNER, { businessId: 'nope' })).rejects.toMatchObject(
      reason('not-found'),
    );
  });
});

describe('redeemQr', () => {
  it('da el sello, crea la tarjeta y avisa al dueño en el token', async () => {
    const token = await issue();

    const res = await handleRedeemQr(at(T0, 5), MARIA, { token });

    expect(res).toEqual({
      businessName: 'Café Demo',
      amount: 1,
      reward: 'Un café gratis',
      cardStamps: 1,
      stampsRequired: 10,
      rewardsEarned: 0,
    });
    const qr = await getData<QrTokenDoc>(`${COLLECTIONS.qrTokens}/${token}`);
    expect(qr).toMatchObject({
      usedByCustomerId: MARIA,
      usedByName: 'María',
      result: { cardStamps: 1, stampsRequired: 10, rewardsEarned: 0 },
    });
    expect(qr?.usedAt?.toMillis()).toBe(T0.getTime() + 5000);

    const member = await getData<MemberDoc>(`${COLLECTIONS.businesses}/${BUSINESS}/${COLLECTIONS.members}/${MARIA}`);
    expect(member).toMatchObject({ customerId: MARIA, name: 'María', searchName: 'maria', currentStamps: 1, rewardsPending: 0 });
    const card = await getData<CardDoc>(`${COLLECTIONS.cards}/${member?.activeCardId}`);
    expect(card).toMatchObject({
      businessName: 'Café Demo',
      ownerUid: OWNER,
      customerId: MARIA,
      stamps: 1,
      stampsRequired: 10,
      status: 'active',
    });

    const visit = await getData<VisitDoc>(`${COLLECTIONS.visits}/${qr?.visitId}`);
    expect(visit).toMatchObject({
      method: 'qr',
      amount: 1,
      localDate: '2026-10-01',
      flowMs: 5000,
      qrToken: token,
      allocations: [{ cardId: member?.activeCardId, count: 1, created: true }],
    });

    const stats = await getData<Record<string, unknown>>(`${COLLECTIONS.businesses}/${BUSINESS}/${COLLECTIONS.stats}/total`);
    expect(stats).toMatchObject({ visits: 1, qrVisits: 1, stamps: 1, newMembers: 1, rewardsEarned: 0, flowMsTotal: 5000 });
    const month = await getData<Record<string, unknown>>(`${COLLECTIONS.businesses}/${BUSINESS}/${COLLECTIONS.stats}/2026-10`);
    expect(month).toMatchObject({ visits: 1 });
  });

  it('suma en la tarjeta que ya existía', async () => {
    const cardId = await seedActiveCard(MARIA, 'María', 4);
    const token = await issue(T0, 2);

    const res = await handleRedeemQr(at(T0, 3), MARIA, { token });

    expect(res).toMatchObject({ cardStamps: 6, rewardsEarned: 0 });
    expect((await getData<CardDoc>(`${COLLECTIONS.cards}/${cardId}`))?.stamps).toBe(6);
    const stats = await getData<Record<string, unknown>>(`${COLLECTIONS.businesses}/${BUSINESS}/${COLLECTIONS.stats}/total`);
    expect(stats).toMatchObject({ newMembers: 0, stamps: 2 });
  });

  it('completa la tarjeta y pasa los sellos que sobran a una nueva (9/10 + 3)', async () => {
    const oldCardId = await seedActiveCard(MARIA, 'María', 9);
    const token = await issue(T0, 3);

    const res = await handleRedeemQr(at(T0, 3), MARIA, { token });

    expect(res).toMatchObject({ cardStamps: 2, stampsRequired: 10, rewardsEarned: 1 });
    const oldCard = await getData<CardDoc>(`${COLLECTIONS.cards}/${oldCardId}`);
    expect(oldCard).toMatchObject({ stamps: 10, status: 'reward_pending' });
    expect(oldCard?.completedAt).not.toBeNull();

    const member = await getData<MemberDoc>(`${COLLECTIONS.businesses}/${BUSINESS}/${COLLECTIONS.members}/${MARIA}`);
    expect(member).toMatchObject({ currentStamps: 2, rewardsPending: 1 });
    expect(member?.activeCardId).not.toBe(oldCardId);
    const newCard = await getData<CardDoc>(`${COLLECTIONS.cards}/${member?.activeCardId}`);
    expect(newCard).toMatchObject({ stamps: 2, status: 'active', completedAt: null });

    const qr = await getData<QrTokenDoc>(`${COLLECTIONS.qrTokens}/${token}`);
    const visit = await getData<VisitDoc>(`${COLLECTIONS.visits}/${qr?.visitId}`);
    expect(visit?.allocations).toEqual([
      { cardId: oldCardId, count: 1, created: false },
      { cardId: member?.activeCardId, count: 2, created: true },
    ]);
  });

  it('no deja usar el mismo QR dos veces', async () => {
    const token = await issue();
    await handleRedeemQr(at(T0, 5), MARIA, { token });

    await expect(handleRedeemQr(at(T0, 6), JUAN, { token })).rejects.toMatchObject({
      code: 'failed-precondition',
      ...reason('used'),
    });
  });

  it('rechaza un QR caducado', async () => {
    const token = await issue();
    await expect(handleRedeemQr(at(T0, 151), MARIA, { token })).rejects.toMatchObject(reason('expired'));
    expect(await visitsCount()).toBe(0);
  });

  it('con dos canjes a la vez solo uno se lleva el sello', async () => {
    const token = await issue();

    const results = await Promise.allSettled([
      handleRedeemQr(at(T0, 5), MARIA, { token }),
      handleRedeemQr(at(T0, 5), JUAN, { token }),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toMatchObject(reason('used'));
    expect(await visitsCount()).toBe(1);
  });

  describe('límite diario', () => {
    it('con límite 1 rechaza la segunda visita del día sin gastar el QR', async () => {
      await handleRedeemQr(at(T0, 5), MARIA, { token: await issue() });
      const second = await issue(new Date(T0.getTime() + 3600_000));

      await expect(handleRedeemQr(at(T0, 3605), MARIA, { token: second })).rejects.toMatchObject(
        reason('daily-limit'),
      );
      expect((await getData<QrTokenDoc>(`${COLLECTIONS.qrTokens}/${second}`))?.usedAt).toBeNull();
      // Otro cliente sí puede usar ese QR.
      await expect(handleRedeemQr(at(T0, 3606), JUAN, { token: second })).resolves.toMatchObject({ cardStamps: 1 });
    });

    it('el día cuenta en la hora del comercio: a las 00:30 de Madrid ya es otro día', async () => {
      const lateNight = new Date('2026-10-01T21:50:00Z'); // 23:50 en Madrid
      const nextDay = new Date('2026-10-01T22:30:00Z'); // 00:30 del día 2 en Madrid
      await handleRedeemQr(at(lateNight, 1), MARIA, { token: await issue(lateNight) });

      const res = await handleRedeemQr(at(nextDay, 1), MARIA, { token: await issue(nextDay) });

      expect(res.cardStamps).toBe(2);
    });

    it('sin límite deja sellar varias veces el mismo día', async () => {
      await seedBusiness({ dailyVisitLimit: null });
      for (let i = 0; i < 3; i++) {
        const base = new Date(T0.getTime() + i * 600_000);
        await handleRedeemQr(at(base, 2), MARIA, { token: await issue(base) });
      }
      const member = await getData<MemberDoc>(`${COLLECTIONS.businesses}/${BUSINESS}/${COLLECTIONS.members}/${MARIA}`);
      expect(member?.currentStamps).toBe(3);
    });

    it('con límite 3 rechaza la cuarta', async () => {
      await seedBusiness({ dailyVisitLimit: 3 });
      for (let i = 0; i < 3; i++) {
        const base = new Date(T0.getTime() + i * 600_000);
        await handleRedeemQr(at(base, 2), MARIA, { token: await issue(base) });
      }
      const base = new Date(T0.getTime() + 3 * 600_000);
      await expect(handleRedeemQr(at(base, 2), MARIA, { token: await issue(base) })).rejects.toMatchObject(
        reason('daily-limit'),
      );
    });
  });

  it('rechaza el QR si el comercio se desactiva después de generarlo', async () => {
    const token = await issue();
    await db.collection(COLLECTIONS.businesses).doc(BUSINESS).update({ active: false });

    await expect(handleRedeemQr(at(T0, 5), MARIA, { token })).rejects.toMatchObject(reason('business-inactive'));
  });

  it('el dueño no puede sellarse a sí mismo', async () => {
    const token = await issue();
    await expect(handleRedeemQr(at(T0, 5), OWNER, { token })).rejects.toMatchObject({
      code: 'permission-denied',
      ...reason('own-business'),
    });
  });

  it('sin perfil pide completarlo y no gasta el QR; al reintentar funciona', async () => {
    const token = await issue();
    const NEW = 'nuevo';

    await expect(handleRedeemQr(at(T0, 20), NEW, { token })).rejects.toMatchObject(reason('profile-required'));
    expect((await getData<QrTokenDoc>(`${COLLECTIONS.qrTokens}/${token}`))?.usedAt).toBeNull();

    await seedCustomer(NEW, 'Rosa');
    await expect(handleRedeemQr(at(T0, 60), NEW, { token })).resolves.toMatchObject({ cardStamps: 1 });
  });

  it('rechaza tokens que no existen o mal formados', async () => {
    await expect(handleRedeemQr(at(T0, 0), MARIA, { token: 'a'.repeat(43) })).rejects.toMatchObject(
      reason('not-found'),
    );
    await expect(handleRedeemQr(at(T0, 0), MARIA, { token: 'abc' })).rejects.toMatchObject(reason('not-found'));
    await expect(handleRedeemQr(at(T0, 0), MARIA, { token: '../businesses/cafe' })).rejects.toMatchObject(
      reason('not-found'),
    );
    await expect(handleRedeemQr(at(T0, 0), MARIA, null)).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('pide sesión', async () => {
    const token = await issue();
    await expect(handleRedeemQr(at(T0, 5), undefined, { token })).rejects.toMatchObject(reason('unauthenticated'));
  });
});
