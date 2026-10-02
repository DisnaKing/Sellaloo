/** Id del contador de visitas de un cliente en un comercio en un día local. */
export function dailyVisitId(businessId: string, memberId: string, date: string): string {
  return `${businessId}_${memberId}_${date}`;
}

/** `limit` es `businesses.dailyVisitLimit`: `null` significa sin límite. */
export function isOverDailyLimit(visitsToday: number, limit: number | null): boolean {
  return limit !== null && visitsToday >= limit;
}
