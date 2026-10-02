// Admin SDK contra los emuladores. Se niega a arrancar con un proyecto que no sea demo-*,
// para que el seed nunca escriba en producción.
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

process.env.GCLOUD_PROJECT ??= 'demo-sellaloo';
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';

if (!process.env.GCLOUD_PROJECT.startsWith('demo-')) {
  throw new Error(`Los scripts solo usan proyectos demo-*, no ${process.env.GCLOUD_PROJECT}.`);
}

const app = initializeApp({ projectId: process.env.GCLOUD_PROJECT });
export const auth = getAuth(app);
export const db = getFirestore(app);
