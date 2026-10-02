import { setGlobalOptions } from 'firebase-functions/v2';
import { onCall } from 'firebase-functions/v2/https';
import { db } from './admin.js';
import { handleIssueQr } from './handlers/issueQr.js';
import { handleRedeemQr } from './handlers/redeemQr.js';
import { REGION } from './shared/model.js';

// Sin instancias mínimas: el MVP vive en la cuota gratuita (ver docs/costes.md).
setGlobalOptions({ region: REGION, maxInstances: 10 });

export const issueQr = onCall((req) => handleIssueQr({ db, now: new Date() }, req.auth?.uid, req.data));

export const redeemQr = onCall((req) => handleRedeemQr({ db, now: new Date() }, req.auth?.uid, req.data));
