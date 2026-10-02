// Tipos y constantes compartidos entre las Functions y la web (alias `@shared`).
// Este fichero no puede importar nada de Firebase: lo usan el Admin SDK y el SDK web.

export const REGION = 'europe-west1';

export const COLLECTIONS = {
  businesses: 'businesses',
  programs: 'programs',
  members: 'members',
  stats: 'stats',
  programTemplates: 'programTemplates',
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

export const DEFAULT_TIMEZONE = 'Europe/Madrid';
/** Visitas con sello al día por cliente y comercio; `null` significa sin límite. */
export const DEFAULT_DAILY_VISIT_LIMIT = 1;

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
  | 'own-business';

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

export interface MemberDoc {
  ownerUid: string;
  businessId: string;
  /** `null` si el dueño lo dio de alta a mano y aún no tiene cuenta. */
  customerId: string | null;
  name: string;
  phone: string | null;
  phoneVerified: boolean;
  currentStamps: number;
  rewardsPending: number;
  activeCardId: string | null;
  lastVisitAt: TimestampLike | null;
  createdAt: TimestampLike;
}

export interface ProgramTemplateDoc {
  businessType: string;
  label: string;
  stampsRequired: number;
  rewardDescription: string;
}

export interface CustomerDoc {
  name: string;
  email: string | null;
  phone: string | null;
  phoneVerified: boolean;
  privacyAcceptedAt: TimestampLike;
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
  amount: number;
  reward: string;
}
