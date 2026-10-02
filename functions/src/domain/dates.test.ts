import { describe, expect, it } from 'vitest';
import { localDate, localMonth } from './dates.js';

describe('localDate', () => {
  it('usa la zona horaria del comercio y no la UTC', () => {
    // 22:30 UTC en horario de verano = 00:30 del día siguiente en Madrid.
    expect(localDate(new Date('2026-10-01T22:30:00Z'), 'Europe/Madrid')).toBe('2026-10-02');
    expect(localDate(new Date('2026-10-01T21:59:59Z'), 'Europe/Madrid')).toBe('2026-10-01');
  });

  it('respeta el horario de invierno y el cambio de año', () => {
    expect(localDate(new Date('2026-12-31T23:30:00Z'), 'Europe/Madrid')).toBe('2027-01-01');
    expect(localDate(new Date('2026-12-31T22:59:59Z'), 'Europe/Madrid')).toBe('2026-12-31');
  });

  it('funciona con otras zonas', () => {
    expect(localDate(new Date('2026-10-01T00:30:00Z'), 'Atlantic/Canary')).toBe('2026-10-01');
    expect(localDate(new Date('2026-10-01T00:30:00Z'), 'America/Mexico_City')).toBe('2026-09-30');
  });
});

describe('localMonth', () => {
  it('devuelve el mes local', () => {
    expect(localMonth(new Date('2026-10-31T23:30:00Z'), 'Europe/Madrid')).toBe('2026-11');
  });
});
