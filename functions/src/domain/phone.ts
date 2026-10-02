/**
 * Normaliza un teléfono a E.164. Sin prefijo, se asume España (+34).
 * Devuelve `null` si no parece un teléfono válido.
 */
// ponytail: solo valida la forma (España: 9 cifras que empiezan por 6–9). Si entran comercios de
// otros países, usar `libphonenumber-js`.
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/[\s.()-]/g, '');
  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`;
  if (/^[6-9]\d{8}$/.test(digits)) return `+34${digits}`;
  if (/^\+34\d*$/.test(digits)) return /^\+34[6-9]\d{8}$/.test(digits) ? digits : null;
  return /^\+[1-9]\d{6,14}$/.test(digits) ? digits : null;
}
