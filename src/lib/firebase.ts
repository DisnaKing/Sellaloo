import { initializeApp } from 'firebase/app';
import { browserPopupRedirectResolver, connectAuthEmulator, indexedDBLocalPersistence, initializeAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import { connectStorageEmulator, getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import {
  REGION,
  type AddMemberRequest,
  type AddMemberResponse,
  type CreateBusinessRequest,
  type CreateBusinessResponse,
  type ErrorReason,
  type IssueQrRequest,
  type IssueQrResponse,
  type RedeemQrRequest,
  type RedeemQrResponse,
  type RedeemRewardRequest,
  type StampByPhoneRequest,
  type StampByPhoneResponse,
  type UndoLastVisitRequest,
  type UndoLastVisitResponse,
} from '@shared/model';

// La configuración web de Firebase es pública. Sin `.env`, la app usa el proyecto demo y los emuladores.
const env = import.meta.env;
const projectId = env.VITE_FIREBASE_PROJECT_ID ?? 'demo-sellaloo';

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY ?? 'demo-key',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? `${projectId}.firebaseapp.com`,
  projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? `${projectId}.firebasestorage.app`,
  appId: env.VITE_FIREBASE_APP_ID,
});

export const auth = initializeAuth(app, {
  persistence: indexedDBLocalPersistence,
  popupRedirectResolver: browserPopupRedirectResolver,
});
auth.languageCode = 'es';
export const db = getFirestore(app);
const functions = getFunctions(app, REGION);
const storage = getStorage(app);

if (projectId.startsWith('demo-')) {
  const host = location.hostname;
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
  connectFunctionsEmulator(functions, host, 5001);
  connectStorageEmulator(storage, host, 9199);
}

export const issueQr = httpsCallable<IssueQrRequest, IssueQrResponse>(functions, 'issueQr');
export const redeemQr = httpsCallable<RedeemQrRequest, RedeemQrResponse>(functions, 'redeemQr');
export const addMember = httpsCallable<AddMemberRequest, AddMemberResponse>(functions, 'addMember');
export const stampByPhone = httpsCallable<StampByPhoneRequest, StampByPhoneResponse>(functions, 'stampByPhone');
export const undoLastVisit = httpsCallable<UndoLastVisitRequest, UndoLastVisitResponse>(functions, 'undoLastVisit');
export const createBusiness = httpsCallable<CreateBusinessRequest, CreateBusinessResponse>(functions, 'createBusiness');
export const redeemReward = httpsCallable<RedeemRewardRequest, void>(functions, 'redeemReward');

const MESSAGES: Record<ErrorReason, string> = {
  'unauthenticated': 'Tienes que entrar primero.',
  'invalid-argument': 'Este enlace no es válido.',
  'not-found': 'Este QR no existe.',
  'not-owner': 'Esta cuenta no puede hacer esto.',
  'business-inactive': 'Este comercio no está activo ahora mismo.',
  'no-program': 'Este comercio aún no tiene tarjeta de sellos.',
  'expired': 'Este QR ha caducado. Pide otro en el mostrador.',
  'used': 'Este QR ya se ha usado. Pide otro en el mostrador.',
  'daily-limit': 'Hoy ya has recibido tu sello aquí.',
  'profile-required': 'Completa tu perfil para recibir el sello.',
  'own-business': 'No puedes darte sellos en tu propio comercio.',
  'invalid-phone': 'Ese teléfono no es válido.',
  'phone-taken': 'Ya hay un cliente con ese teléfono.',
  'unknown-phone': 'No hay ningún cliente con ese teléfono.',
  'nothing-to-undo': 'No hay ninguna visita que deshacer.',
  'undo-expired': 'Solo se pueden deshacer las visitas de hoy.',
  'already-redeemed': 'Ese premio ya se ha canjeado.',
  'has-business': 'Ya tienes un comercio.',
};

/** Reduce el logo a 256 px como mucho y lo sube a `logos/{uid}/logo`. Devuelve su URL pública. */
export async function uploadLogo(uid: string, file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d')!;
  // Fondo blanco por si acaba en JPEG, que no tiene transparencia.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const toBlob = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
  // Safari no siempre sabe generar WebP y devuelve PNG: entonces va en JPEG.
  let blob = await toBlob('image/webp');
  if (blob?.type !== 'image/webp') blob = await toBlob('image/jpeg');
  const logoRef = ref(storage, `logos/${uid}/logo`);
  await uploadBytes(logoRef, blob!, { contentType: blob!.type });
  return getDownloadURL(logoRef);
}

const AUTH_MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'El correo o la contraseña no son correctos.',
  'auth/email-already-in-use': 'Ya hay una cuenta con este correo. Pulsa «Entrar».',
  'auth/weak-password': 'La contraseña necesita al menos 6 caracteres.',
  'auth/invalid-email': 'Ese correo no es válido.',
  'auth/invalid-phone-number': 'Ese teléfono no es válido.',
  'auth/invalid-verification-code': 'El código no es correcto.',
  'auth/too-many-requests': 'Demasiados intentos. Espera un poco.',
  'auth/network-request-failed': 'Sin conexión. Revisa tu internet.',
};

/** Traduce cualquier error de Firebase a un mensaje para la pantalla. */
export function errorMessage(e: unknown): string {
  const err = e as { code?: string; details?: { reason?: ErrorReason } };
  const reason = err.details?.reason;
  if (reason && reason in MESSAGES) return MESSAGES[reason];
  return AUTH_MESSAGES[err.code ?? ''] ?? 'Algo ha fallado. Inténtalo otra vez.';
}
