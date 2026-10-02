import { beforeEach, describe, expect, it } from 'vitest';
import { handleCreateBusiness } from '../src/handlers/createBusiness.js';
import { handleIssueQr } from '../src/handlers/issueQr.js';
import { handleRedeemQr } from '../src/handlers/redeemQr.js';
import { COLLECTIONS, LEGAL_VERSION, type BusinessDoc, type ProgramDoc } from '../src/shared/model.js';
import { MARIA, T0, at, clearFirestore, db, getData, seedCustomer } from './helpers.js';

const NEW_OWNER = 'owner-2';
const reason = (r: string) => ({ details: { reason: r } });
const create = (data: Record<string, unknown> = {}) =>
  handleCreateBusiness(at(T0, 0), NEW_OWNER, {
    name: ' Pelu Ana ',
    type: 'peluqueria',
    stampsRequired: 8,
    rewardDescription: 'Un corte gratis',
    ...data,
  });

beforeEach(clearFirestore);

describe('createBusiness', () => {
  it('crea el comercio y su programa con los valores por defecto', async () => {
    const { businessId } = await create();
    expect(businessId).toBe(NEW_OWNER);
    expect(await getData<BusinessDoc>(`${COLLECTIONS.businesses}/${businessId}`)).toMatchObject({
      ownerUid: NEW_OWNER,
      name: 'Pelu Ana',
      type: 'peluqueria',
      dailyVisitLimit: 1,
      timezone: 'Europe/Madrid',
      active: true,
      firstStampAt: null,
      termsVersion: LEGAL_VERSION,
    });
    const programs = await db.collection(`${COLLECTIONS.businesses}/${businessId}/${COLLECTIONS.programs}`).get();
    expect(programs.docs.map((d) => d.data() as ProgramDoc)).toMatchObject([
      { ownerUid: NEW_OWNER, stampsRequired: 8, rewardDescription: 'Un corte gratis', stampExpiryMonths: null, active: true },
    ]);
  });

  it('solo uno por dueño', async () => {
    await create();
    await expect(create()).rejects.toMatchObject(reason('has-business'));
  });

  it('valida los datos', async () => {
    await expect(create({ name: ' ' })).rejects.toMatchObject(reason('invalid-argument'));
    await expect(create({ type: 'banco' })).rejects.toMatchObject(reason('invalid-argument'));
    await expect(create({ stampsRequired: 1 })).rejects.toMatchObject(reason('invalid-argument'));
    await expect(create({ stampsRequired: 8.5 })).rejects.toMatchObject(reason('invalid-argument'));
    await expect(handleCreateBusiness(at(T0, 0), undefined, {})).rejects.toMatchObject(reason('unauthenticated'));
  });

  it('el primer sello queda apuntado para medir el alta', async () => {
    await create();
    await seedCustomer(MARIA, 'María');
    const { token } = await handleIssueQr(at(T0, 120), NEW_OWNER, { businessId: NEW_OWNER });
    await handleRedeemQr(at(T0, 130), MARIA, { token });
    const business = await getData<BusinessDoc>(`${COLLECTIONS.businesses}/${NEW_OWNER}`);
    expect(business!.firstStampAt!.toMillis() - business!.createdAt.toMillis()).toBe(130_000);
  });
});
