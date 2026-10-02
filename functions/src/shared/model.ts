// Tipos y constantes compartidos entre las Functions y la web (alias `@shared`).
// Este fichero no puede importar nada de Firebase: lo usan el Admin SDK y el SDK web.

export const REGION = 'europe-west1';

export const COLLECTIONS = {
  businesses: 'businesses',
  programs: 'programs',
  members: 'members',
  stats: 'stats',
  customers: 'customers',
  cards: 'cards',
  qrTokens: 'qrTokens',
  visits: 'visits',
  dailyVisits: 'dailyVisits',
} as const;

/** Segundos que vive un QR desde que se genera. */
export const QR_TTL_SECONDS = 150;
export const QR_AMOUNTS = [1, 2, 3] as const;
export type QrAmount = (typeof QR_AMOUNTS)[number];

/** Versión de los textos de `/legal`. Cámbiala al cambiarlos: se guarda con cada aceptación. */
export const LEGAL_VERSION = '2026-10-02';

export const DEFAULT_TIMEZONE = 'Europe/Madrid';
/** Visitas con sello al día por cliente y comercio; `null` significa sin límite. */
export const DEFAULT_DAILY_VISIT_LIMIT = 1;
/** Sellos de una tarjeta; `firestore.rules` repite estos límites. */
export const MIN_STAMPS_REQUIRED = 2;
export const MAX_STAMPS_REQUIRED = 20;

/** Motivo de error que viaja en `HttpsError.details.reason` para que la web muestre el mensaje adecuado. */
export type ErrorReason =
  | 'unauthenticated'
  | 'invalid-argument'
  | 'not-found'
  | 'not-owner'
  | 'business-inactive'
  | 'no-program'
  | 'expired'
  | 'used'
  | 'daily-limit'
  | 'profile-required'
  | 'own-business'
  | 'invalid-phone'
  | 'phone-taken'
  | 'unknown-phone'
  | 'nothing-to-undo'
  | 'undo-expired'
  | 'already-redeemed'
  | 'has-business';

export interface ErrorDetails {
  reason: ErrorReason;
}

// --- Documentos de Firestore -------------------------------------------------

/** Lo que tienen en común el `Timestamp` del Admin SDK y el del SDK web. */
export interface TimestampLike {
  toMillis(): number;
  toDate(): Date;
}

export type CardStatus = 'active' | 'reward_pending' | 'redeemed';
export type VisitMethod = 'qr' | 'phone';

export interface BusinessDoc {
  ownerUid: string;
  name: string;
  type: string;
  logoUrl: string | null;
  timezone: string;
  dailyVisitLimit: number | null;
  plan: 'free';
  active: boolean;
  createdAt: TimestampLike;
  /** Primer sello dado; con `createdAt` mide cuánto tarda el alta. */
  firstStampAt: TimestampLike | null;
  /** Versión de `/legal` que aceptó el dueño al darse de alta (en `createdAt`). */
  termsVersion: string;
}

export interface ProgramDoc {
  ownerUid: string;
  stampsRequired: number;
  rewardDescription: string;
  /** Meses sin visitas tras los que la tarjeta activa vuelve a 0; `null` = no caducan. */
  stampExpiryMonths: number | null;
  active: boolean;
  createdAt: TimestampLike;
}

/** Normaliza un nombre para buscar: «José» y «jose» dan lo mismo. */
export const toSearchName = (name: string): string =>
  name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

export interface MemberDoc {
  ownerUid: string;
  businessId: string;
  /** `null` si el dueño lo dio de alta a mano y aún no tiene cuenta. */
  customerId: string | null;
  name: string;
  /** `name` en minúsculas y sin acentos, para buscar por prefijo (ver `toSearchName`). */
  searchName: string;
  phone: string | null;
  phoneVerified: boolean;
  currentStamps: number;
  rewardsPending: number;
  activeCardId: string | null;
  lastVisitAt: TimestampLike | null;
  createdAt: TimestampLike;
}

export interface ProgramTemplate {
  businessType: string;
  label: string;
  stampsRequired: number;
  rewardDescription: string;
}

// ponytail: plantillas en código; pasan a Firestore si el admin tiene que editarlas.
export const PROGRAM_TEMPLATES: ProgramTemplate[] = [
  { businessType: 'peluqueria', label: 'Peluquería', stampsRequired: 8, rewardDescription: 'Un corte gratis' },
  { businessType: 'estetica', label: 'Estética', stampsRequired: 6, rewardDescription: 'Un tratamiento gratis' },
  { businessType: 'cafeteria', label: 'Cafetería', stampsRequired: 10, rewardDescription: 'Un café gratis' },
  { businessType: 'panaderia', label: 'Panadería', stampsRequired: 10, rewardDescription: 'Una barra de pan gratis' },
  { businessType: 'otros', label: 'Otro', stampsRequired: 10, rewardDescription: 'Un regalo' },
];

export interface CustomerDoc {
  name: string;
  email: string | null;
  phone: string | null;
  phoneVerified: boolean;
  privacyAcceptedAt: TimestampLike;
  privacyVersion: string;
  createdAt: TimestampLike;
}

export interface CardDoc {
  businessId: string;
  /** Copia del nombre del comercio para pintar las tarjetas sin leer `businesses`. */
  businessName: string;
  ownerUid: string;
  programId: string;
  memberId: string;
  customerId: string | null;
  customerPhone: string | null;
  stamps: number;
  stampsRequired: number;
  reward: string;
  status: CardStatus;
  createdAt: TimestampLike;
  lastStampAt: TimestampLike | null;
  completedAt: TimestampLike | null;
  redeemedAt: TimestampLike | null;
  /** Si llega esta fecha sin otra visita, los sellos de la tarjeta activa vuelven a 0; `null` = no caducan. */
  stampsExpireAt: TimestampLike | null;
}

/** Resultado de canjear un QR; lo ven el cliente (respuesta) y el dueño (en el token). */
export interface StampResult {
  /** Sellos de la tarjeta que queda activa. */
  cardStamps: number;
  stampsRequired: number;
  /** Tarjetas completadas en esta visita. */
  rewardsEarned: number;
}

export interface QrTokenDoc {
  businessId: string;
  ownerUid: string;
  amount: QrAmount;
  createdAt: TimestampLike;
  expiresAt: TimestampLike;
  usedAt: TimestampLike | null;
  usedByCustomerId: string | null;
  usedByName: string | null;
  visitId: string | null;
  result: StampResult | null;
}

export interface VisitAllocation {
  cardId: string;
  count: number;
  /** La tarjeta se creó en esta visita (hay que borrarla al deshacer). */
  created: boolean;
}

export interface VisitDoc {
  businessId: string;
  ownerUid: string;
  memberId: string;
  customerId: string | null;
  amount: number;
  method: VisitMethod;
  localDate: string;
  allocations: VisitAllocation[];
  qrToken: string | null;
  /** Milisegundos desde que se generó el QR hasta que se canjeó. */
  flowMs: number | null;
  createdAt: TimestampLike;
  undoneAt: TimestampLike | null;
}

export interface DailyVisitDoc {
  businessId: string;
  memberId: string;
  localDate: string;
  count: number;
  expiresAt: TimestampLike;
}

// --- Llamadas a Functions ----------------------------------------------------

export interface IssueQrRequest {
  businessId: string;
  amount?: QrAmount;
}

export interface IssueQrResponse {
  token: string;
  /** Milisegundos epoch, según el reloj del servidor. */
  expiresAt: number;
  /** Duración del QR; la web cuenta hacia atrás con su propio reloj para evitar desfases. */
  ttlSeconds: number;
}

export interface RedeemQrRequest {
  token: string;
}

export interface RedeemQrResponse extends StampResult {
  businessName: string;
  logoUrl: string | null;
  amount: number;
  reward: string;
}

export interface AddMemberRequest {
  businessId: string;
  name: string;
  phone: string;
}

export interface AddMemberResponse {
  memberId: string;
  /** Teléfono normalizado (E.164). */
  phone: string;
}

export interface StampByPhoneRequest {
  businessId: string;
  phone: string;
  amount?: QrAmount;
}

export interface StampByPhoneResponse extends StampResult {
  memberId: string;
  name: string;
}

export interface UndoLastVisitRequest {
  businessId: string;
}

export interface UndoLastVisitResponse {
  name: string;
  amount: number;
}

export interface RedeemRewardRequest {
  cardId: string;
}

export interface CreateBusinessRequest {
  name: string;
  type: string;
  stampsRequired: number;
  rewardDescription: string;
}

export interface CreateBusinessResponse {
  businessId: string;
}

export interface ClaimPhoneCardsResponse {
  /** Fichas de comercios que se han juntado con la cuenta. */
  claimed: number;
}
