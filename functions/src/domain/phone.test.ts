import { describe, expect, it } from 'vitest';
import { normalizePhone } from './phone.js';

describe('normalizePhone', () => {
  it('añade +34 a los números españoles sin prefijo', () => {
    expect(normalizePhone('600 000 001')).toBe('+34600000001');
    expect(normalizePhone('912-345-678')).toBe('+34912345678');
  });

  it('acepta +34 y 0034', () => {
    expect(normalizePhone('+34 600000001')).toBe('+34600000001');
    expect(normalizePhone('0034 (600) 00.00.01')).toBe('+34600000001');
  });

  it('acepta otros países en E.164', () => {
    expect(normalizePhone('+33 6 12 34 56 78')).toBe('+33612345678');
  });

  it('rechaza lo que no es un teléfono', () => {
    for (const bad of ['', 'abc', '12345', '500000000', '+34 600', '+34 5000000001', '+0123456789']) {
      expect(normalizePhone(bad)).toBeNull();
    }
  });
});
