/** Fecha local `AAAA-MM-DD` de `date` en la zona horaria indicada (p. ej. `Europe/Madrid`). */
export function localDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Mes local `AAAA-MM`; es el id de los documentos de estadísticas mensuales. */
export function localMonth(date: Date, timeZone: string): string {
  return localDate(date, timeZone).slice(0, 7);
}
