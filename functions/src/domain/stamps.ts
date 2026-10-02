export interface StampAllocation {
  /** Sellos que recibe cada tarjeta, en orden. La primera es la activa actual; las demás son nuevas. */
  added: number[];
  /** Tarjetas que se completan en esta visita (todas menos la última). */
  completed: number;
  /** Sellos de la tarjeta que queda activa al final (la última de `added`). */
  activeStamps: number;
}

/**
 * Reparte `amount` sellos empezando por la tarjeta activa. Cuando una tarjeta se completa,
 * los sellos sobrantes pasan a una tarjeta nueva de `nextRequired` sellos. Si la última
 * tarjeta se completa justo, se abre otra vacía para que siempre quede una activa.
 */
export function allocateStamps(
  currentStamps: number,
  stampsRequired: number,
  amount: number,
  nextRequired: number = stampsRequired,
): StampAllocation {
  assertCount('stampsRequired', stampsRequired, 1);
  assertCount('nextRequired', nextRequired, 1);
  assertCount('amount', amount, 1);
  assertCount('currentStamps', currentStamps, 0);
  if (currentStamps >= stampsRequired) {
    throw new RangeError(`currentStamps (${currentStamps}) debe ser menor que stampsRequired (${stampsRequired})`);
  }

  const added = [0];
  let stamps = currentStamps;
  let required = stampsRequired;
  let completed = 0;
  for (let i = 0; i < amount; i++) {
    added[added.length - 1]! += 1;
    stamps += 1;
    if (stamps === required) {
      completed += 1;
      stamps = 0;
      required = nextRequired;
      added.push(0);
    }
  }
  return { added, completed, activeStamps: stamps };
}

function assertCount(name: string, value: number, min: number): void {
  if (!Number.isInteger(value) || value < min) {
    throw new RangeError(`${name} debe ser un entero mayor o igual que ${min}`);
  }
}
