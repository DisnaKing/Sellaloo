import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Una sola app de Admin para las Functions y para los tests contra el emulador.
const app = getApps()[0] ?? initializeApp();

export const db = getFirestore(app);
export const auth = getAuth(app);
