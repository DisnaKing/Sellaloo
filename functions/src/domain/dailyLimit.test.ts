import { describe, expect, it } from 'vitest';
import { dailyVisitId, isOverDailyLimit } from './dailyLimit.js';

describe('isOverDailyLimit', () => {
  it('con límite 1 solo permite la primera visita del día', () => {
    expect(isOverDailyLimit(0, 1)).toBe(false);
    expect(isOverDailyLimit(1, 1)).toBe(true);
  });

  it('con límite 3 permite tres visitas', () => {
    expect(isOverDailyLimit(2, 3)).toBe(false);
    expect(isOverDailyLimit(3, 3)).toBe(true);
  });

  it('sin límite nunca bloquea', () => {
    expect(isOverDailyLimit(50, null)).toBe(false);
  });
});

describe('dailyVisitId', () => {
  it('junta comercio, cliente y día', () => {
    expect(dailyVisitId('b1', 'u1', '2026-10-01')).toBe('b1_u1_2026-10-01');
  });
});
