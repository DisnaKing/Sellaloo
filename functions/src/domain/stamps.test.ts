import { describe, expect, it } from 'vitest';
import { allocateStamps } from './stamps.js';

describe('allocateStamps', () => {
  it('suma a la tarjeta activa si no se completa', () => {
    expect(allocateStamps(3, 10, 1)).toEqual({ added: [1], completed: 0, activeStamps: 4 });
    expect(allocateStamps(0, 10, 3)).toEqual({ added: [3], completed: 0, activeStamps: 3 });
  });

  it('pasa los sobrantes a una tarjeta nueva', () => {
    expect(allocateStamps(9, 10, 3)).toEqual({ added: [1, 2], completed: 1, activeStamps: 2 });
  });

  it('abre una tarjeta vacía si la actual se completa justo', () => {
    expect(allocateStamps(8, 10, 2)).toEqual({ added: [2, 0], completed: 1, activeStamps: 0 });
  });

  it('puede completar varias tarjetas en una visita', () => {
    expect(allocateStamps(0, 1, 3)).toEqual({ added: [1, 1, 1, 0], completed: 3, activeStamps: 0 });
    expect(allocateStamps(1, 2, 3)).toEqual({ added: [1, 2, 0], completed: 2, activeStamps: 0 });
  });

  it('usa el tamaño de la tarjeta nueva para los sobrantes', () => {
    expect(allocateStamps(9, 10, 3, 2)).toEqual({ added: [1, 2, 0], completed: 2, activeStamps: 0 });
  });

  it('rechaza valores fuera de rango', () => {
    expect(() => allocateStamps(10, 10, 1)).toThrow(RangeError);
    expect(() => allocateStamps(-1, 10, 1)).toThrow(RangeError);
    expect(() => allocateStamps(0, 0, 1)).toThrow(RangeError);
    expect(() => allocateStamps(0, 10, 0)).toThrow(RangeError);
    expect(() => allocateStamps(0, 10, 1.5)).toThrow(RangeError);
  });
});
