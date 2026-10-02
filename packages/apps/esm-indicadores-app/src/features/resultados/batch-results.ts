/**
 * Classify a batch calculation/recalculation result as a "total failure".
 *
 * A batch is a total failure when ZERO items succeeded AND there is at
 * least one error AND the backend actually attempted at least one item.
 *
 * This is safer than `errorCount >= total` because the backend's `total`
 * may exceed the reported error count (e.g. `total` represents attempted
 * month × indicator combinations while `errores` only lists the failed
 * ones). The four inline copies of this logic in `ResultadosPage` are
 * intentionally unified here so the edge-case stays in one testable place.
 */
export function isBatchTotalFailure(input: {
  /** Number of items that succeeded (`calculados` or `recalculados`). */
  successes: number;
  /** Number of reported errors (`result.errores.length`). */
  errorCount: number;
  /** Number of items the backend attempted (`result.total`). */
  total: number;
}): boolean {
  return input.successes === 0 && input.errorCount > 0 && input.total > 0;
}
