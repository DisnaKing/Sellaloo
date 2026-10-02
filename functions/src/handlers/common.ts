import type { Firestore } from 'firebase-admin/firestore';
import { HttpsError, type FunctionsErrorCode } from 'firebase-functions/v2/https';
import { QR_AMOUNTS, type ErrorDetails, type ErrorReason, type QrAmount } from '../shared/model.js';

/** Dependencias de los handlers; los tests las inyectan para controlar la hora. */
export interface HandlerDeps {
  db: Firestore;
  now: Date;
}

export function fail(code: FunctionsErrorCode, reason: ErrorReason, message: string): never {
  const details: ErrorDetails = { reason };
  throw new HttpsError(code, message, details);
}

export function requireUid(uid: string | undefined): string {
  if (!uid) fail('unauthenticated', 'unauthenticated', 'Inicia sesión para continuar.');
  return uid;
}

export function asRecord(data: unknown): Record<string, unknown> {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    fail('invalid-argument', 'invalid-argument', 'Petición no válida.');
  }
  return data as Record<string, unknown>;
}

/** Id de documento seguro: evita rutas con `/` y valores vacíos o enormes. */
export function isDocId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

/** Sellos de una visita: 1, 2 o 3 (1 si no se indica). */
export function parseAmount(amount: unknown = 1): QrAmount {
  if (!QR_AMOUNTS.includes(amount as QrAmount)) {
    fail('invalid-argument', 'invalid-argument', 'Se pueden dar 1, 2 o 3 sellos.');
  }
  return amount as QrAmount;
}
