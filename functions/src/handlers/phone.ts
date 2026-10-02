import { Timestamp } from 'firebase-admin/firestore';
import { auth } from '../admin.js';
import { localDate } from '../domain/dates.js';
import { normalizePhone } from '../domain/phone.js';
import {
  COLLECTIONS,
  DEFAULT_TIMEZONE,
  type AddMemberResponse,
  type CustomerDoc,
  type MemberDoc,
  type ProgramDoc,
  type StampByPhoneResponse,
} from '../shared/model.js';
import { asRecord, fail, isDocId, parseAmount, requireUid, type HandlerDeps } from './common.js';
import { addStats, readOwnedBusiness, stamp, type StampInput } from './stamp.js';

function parsePhone(phone: unknown): string {
  const normalized = typeof phone === 'string' ? normalizePhone(phone) : null;
  if (!normalized) fail('invalid-argument', 'invalid-phone', 'Ese teléfono no es válido.');
  return normalized;
}

function parseBusinessId(businessId: unknown): string {
  if (!isDocId(businessId)) fail('invalid-argument', 'invalid-argument', 'Falta el comercio.');
  return businessId;
}

/** Alta manual de un cliente sin cuenta (`customerId` nulo). No puede repetir teléfono en el comercio. */
export async function handleAddMember(
  { db, now }: HandlerDeps,
  authUid: string | undefined,
  data: unknown,
): Promise<AddMemberResponse> {
  const uid = requireUid(authUid);
  const req = asRecord(data);
  const businessId = parseBusinessId(req.businessId);
  const phone = parsePhone(req.phone);
  const name = typeof req.name === 'string' ? req.name.trim() : '';
  if (name.length < 1 || name.length > 60) fail('invalid-argument', 'invalid-argument', 'Falta el nombre.');

  return db.runTransaction(async (tx) => {
    const { ref, business } = await readOwnedBusiness(db, tx, uid, businessId);
    const members = ref.collection(COLLECTIONS.members);
    const taken = await tx.get(members.where('phone', '==', phone).limit(1));
    if (!taken.empty) fail('already-exists', 'phone-taken', 'Ya hay un cliente con ese teléfono.');

    const nowTs = Timestamp.fromDate(now);
    const memberRef = members.doc();
    tx.create(memberRef, {
      ownerUid: uid,
      businessId,
      customerId: null,
      name,
      phone,
      phoneVerified: false,
      currentStamps: 0,
      rewardsPending: 0,
      activeCardId: null,
      lastVisitAt: null,
      createdAt: nowTs,
    } satisfies MemberDoc);
    addStats(tx, ref, localDate(now, business.timezone || DEFAULT_TIMEZONE), uid, nowTs, { newMembers: 1, phoneSignups: 1 });
    return { memberId: memberRef.id, phone };
  });
}

/**
 * El dueño sella a un cliente por su teléfono. Lo busca así:
 * 1. una cuenta con ese teléfono verificado por SMS (y con perfil);
 * 2. una ficha del comercio con ese teléfono;
 * 3. si no hay ninguna, `unknown-phone`: la web ofrece el alta manual.
 */
export async function handleStampByPhone(
  { db, now }: HandlerDeps,
  authUid: string | undefined,
  data: unknown,
): Promise<StampByPhoneResponse> {
  const uid = requireUid(authUid);
  const req = asRecord(data);
  const businessId = parseBusinessId(req.businessId);
  const phone = parsePhone(req.phone);
  const amount = parseAmount(req.amount);
  const accountUid = await auth.getUserByPhoneNumber(phone).then(
    (user) => user.uid,
    () => null,
  );

  return db.runTransaction(async (tx) => {
    const { ref, business } = await readOwnedBusiness(db, tx, uid, businessId);
    const members = ref.collection(COLLECTIONS.members);
    const [programsSnap, customerSnap, byPhone] = await Promise.all([
      tx.get(ref.collection(COLLECTIONS.programs).where('active', '==', true).limit(1)),
      accountUid ? tx.get(db.collection(COLLECTIONS.customers).doc(accountUid)) : null,
      tx.get(members.where('phone', '==', phone).limit(1)),
    ]);
    const programSnap = programsSnap.docs[0];
    if (!business.active || !programSnap) {
      fail('failed-precondition', 'business-inactive', 'El comercio no está dando sellos ahora mismo.');
    }

    const customer = customerSnap?.data() as CustomerDoc | undefined;
    let found: Pick<StampInput, 'memberRef' | 'member' | 'holder'>;
    if (accountUid && customer) {
      if (accountUid === uid) fail('permission-denied', 'own-business', 'No puedes darte sellos a ti mismo.');
      const memberRef = members.doc(accountUid);
      found = {
        memberRef,
        member: (await tx.get(memberRef)).data() as MemberDoc | undefined,
        holder: { customerId: accountUid, name: customer.name, phone, phoneVerified: true },
      };
    } else if (byPhone.docs[0]) {
      const member = byPhone.docs[0].data() as MemberDoc;
      found = {
        memberRef: byPhone.docs[0].ref,
        member,
        holder: {
          customerId: member.customerId,
          name: member.name,
          phone: member.phone,
          phoneVerified: member.phoneVerified,
        },
      };
    } else {
      fail('not-found', 'unknown-phone', 'No hay ningún cliente con ese teléfono.');
    }

    const { result } = await stamp(db, tx, now, {
      ...found,
      businessId,
      business,
      programId: programSnap.id,
      program: programSnap.data() as ProgramDoc,
      amount,
      method: 'phone',
      qrToken: null,
      flowMs: null,
    });
    return { ...result, memberId: found.memberRef.id, name: found.holder.name };
  });
}
