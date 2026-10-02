import { setGlobalOptions } from 'firebase-functions/v2';
import { onCall } from 'firebase-functions/v2/https';
import { db } from './admin.js';
import { handleClaimPhoneCards, handleDeleteAccount } from './handlers/account.js';
import { handleCreateBusiness } from './handlers/createBusiness.js';
import { handleIssueQr } from './handlers/issueQr.js';
import { handleAddMember, handleStampByPhone } from './handlers/phone.js';
import { handleRedeemQr } from './handlers/redeemQr.js';
import { handleRedeemReward } from './handlers/redeemReward.js';
import { handleUndoLastVisit } from './handlers/undoLastVisit.js';
import { REGION } from './shared/model.js';

// Sin instancias mínimas: el MVP vive en la cuota gratuita (ver docs/costes.md).
// App Check se exige con ENFORCE_APP_CHECK=true en `functions/.env.<proyecto>` (ver docs/lanzamiento.md).
setGlobalOptions({ region: REGION, maxInstances: 10, enforceAppCheck: process.env.ENFORCE_APP_CHECK === 'true' });

export const issueQr = onCall((req) => handleIssueQr({ db, now: new Date() }, req.auth?.uid, req.data));

export const redeemQr = onCall((req) => handleRedeemQr({ db, now: new Date() }, req.auth?.uid, req.data));

export const addMember = onCall((req) => handleAddMember({ db, now: new Date() }, req.auth?.uid, req.data));

export const stampByPhone = onCall((req) => handleStampByPhone({ db, now: new Date() }, req.auth?.uid, req.data));

export const undoLastVisit = onCall((req) => handleUndoLastVisit({ db, now: new Date() }, req.auth?.uid, req.data));

export const redeemReward = onCall((req) => handleRedeemReward({ db, now: new Date() }, req.auth?.uid, req.data));

export const createBusiness = onCall((req) => handleCreateBusiness({ db, now: new Date() }, req.auth?.uid, req.data));

export const claimPhoneCards = onCall((req) => handleClaimPhoneCards({ db, now: new Date() }, req.auth?.uid));

export const deleteAccount = onCall((req) => handleDeleteAccount({ db, now: new Date() }, req.auth?.uid));
