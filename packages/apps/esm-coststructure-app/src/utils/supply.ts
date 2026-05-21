export function calculateUnitCostSupply(acquisitionPrice: number, equivalence: number) {
  if (!equivalence || equivalence <= 0) return 0;
  return acquisitionPrice / equivalence;
}

export function calculateStandardCostSupply(unitCost: number, quantity: number, minutes?: number) {
  if (minutes === undefined) minutes = 1;
  return unitCost * quantity * minutes;
}

/** @deprecated Use calculateStandardCostSupply instead. */
export const calculateStandarCostSupply = calculateStandardCostSupply;
