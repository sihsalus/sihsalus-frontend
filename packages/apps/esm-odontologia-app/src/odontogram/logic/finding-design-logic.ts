/**
 * Lógica pura para calcular dynamicDesign de hallazgos de spacing.
 *
 * Para hallazgos con adyacencia (1, 2, 30, 32, 39):
 * - El design de un ESPACIO depende de si los DIENTES adyacentes tienen el hallazgo activo
 * - El design de un DIENTE depende de si los ESPACIOS adyacentes tienen el hallazgo activo
 *
 * NO tiene estado. Recibe datos, retorna datos transformados.
 */

import type { LegendSpaceData, SpaceData, ToothData } from '../types/odontogram';

// =============================================================================
// CÁLCULO DE DYNAMIC DESIGN POR ADYACENCIA
// =============================================================================

/**
 * IDs de hallazgos que usan lógica de adyacencia para calcular dynamicDesign.
 */
const ADJACENCY_FINDINGS = new Set([1, 2, 30, 32, 39]);

/**
 * IDs de hallazgos que dependen de la posición (upper/lower) para dynamicDesign.
 * Design 1 = upper, Design 2 = lower
 */
const POSITION_DEPENDENT_FINDINGS = new Set([24, 25]);

/**
 * IDs de hallazgos de tipo "row" — se aplican a TODOS los dientes de una posición.
 * El spacing toggle está deshabilitado (no-op).
 */
const ROW_FINDINGS = new Set([7, 31]);

/**
 * IDs de hallazgos cuyo spacing almacena findings[] (en vez de solo color).
 * Los demás spacing findings usan color-based.
 */
const FINDINGS_BASED_SPACING = new Set([6, 13, 26, 39]);

/**
 * Hallazgos en dientes con dynamicDesign fijo = 1.
 */
const FIXED_DESIGN_FINDINGS = new Set([3, 4, 7, 12, 20, 21, 23, 28, 38]);

/**
 * IDs de hallazgos que usan adyacencia directa diente-a-diente (no via spacing).
 * El design del diente depende de si sus dientes vecinos (en la misma arcada)
 * tienen el mismo hallazgo activo.
 *
 * Design 1 = vecino derecho tiene el hallazgo (o solo este diente, sin precedente)
 * Design 2 = vecino izquierdo tiene el hallazgo (último de la cadena)
 * Design 3 = ambos vecinos (izq y der) tienen el hallazgo
 */
const TOOTH_ADJACENCY_FINDINGS = new Set([11]);

/**
 * IDs de hallazgos que permiten MÚLTIPLES diseños simultáneamente en el mismo diente.
 * Para estos hallazgos, seleccionar un nuevo diseño AGREGA (no reemplaza).
 * Seleccionar un diseño ya aplicado lo ELIMINA.
 */
const MULTI_DESIGN_FINDINGS = new Set([5, 10, 16, 27, 34, 35, 37]);

// =============================================================================
// FUNCIONES PURAS DE CÁLCULO
// =============================================================================

/**
 * Determina si un diente tiene un hallazgo activo (con color).
 */
function toothHasFinding(teeth: ToothData[], toothId: number, findingId: number): boolean {
  const tooth = teeth.find((t) => t.toothId === toothId);
  if (!tooth) return false;
  return tooth.findings.some((f) => f.findingId === findingId && f.color != null);
}

/**
 * Determina si un spacing tiene el hallazgo activo.
 */
function isSpaceActive(space: SpaceData, findingId: number): boolean {
  return space.findings.some((f) => f.findingId === findingId);
}

/**
 * Calcula el dynamicDesign de un ESPACIO basándose en los DIENTES adyacentes.
 *
 * - leftTooth tiene el hallazgo AND rightTooth tiene el hallazgo → design 3
 * - leftTooth tiene el hallazgo solamente → design 1
 * - rightTooth tiene el hallazgo solamente (o default) → design 2
 *
 * Solo calcula si el espacio MISMO tiene el hallazgo activo.
 */
export function calculateSpacingDesignFromTeeth(space: SpaceData, findingId: number, teeth: ToothData[]): number {
  if (!isSpaceActive(space, findingId)) return 2; // default

  const leftHas = toothHasFinding(teeth, space.leftToothId, findingId);
  const rightHas = toothHasFinding(teeth, space.rightToothId, findingId);

  if (leftHas && rightHas) return 3;
  if (leftHas) return 1;
  return 2; // rightHas or default
}

/**
 * Recalcula todos los dynamicDesign de espacios para un hallazgo,
 * basándose en qué DIENTES tienen ese hallazgo activo.
 */
export function recalculateSpacingDesigns(spaces: SpaceData[], findingId: number, teeth: ToothData[]): SpaceData[] {
  return spaces.map((space) => {
    if (!isSpaceActive(space, findingId)) return space;

    const newDesign = calculateSpacingDesignFromTeeth(space, findingId, teeth);
    const updatedFindings = space.findings.map((f) =>
      f.findingId === findingId ? { ...f, designNumber: newDesign } : f,
    );

    return { ...space, findings: updatedFindings };
  });
}

/**
 * Calcula el dynamicDesign de un DIENTE basándose en los ESPACIOS adyacentes.
 *
 * - No hay espacio izquierdo (primer diente) → design 1
 * - No hay espacio derecho (último diente) → design 2
 * - Ambos espacios tienen el hallazgo → design 3
 * - Solo espacio izquierdo tiene el hallazgo → design 2
 * - Solo espacio derecho tiene el hallazgo → design 1
 */
export function calculateToothDesignFromSpaces(toothId: number, findingId: number, spaces: SpaceData[]): number {
  // Espacio a la izquierda del diente (el diente es el rightToothId del espacio)
  const leftSpace = spaces.find((s) => s.rightToothId === toothId);
  // Espacio a la derecha del diente (el diente es el leftToothId del espacio)
  const rightSpace = spaces.find((s) => s.leftToothId === toothId);

  if (!leftSpace) return 1; // primer diente
  if (!rightSpace) return 2; // último diente

  const leftActive = isSpaceActive(leftSpace, findingId);
  const rightActive = isSpaceActive(rightSpace, findingId);

  if (leftActive && rightActive) return 3;
  if (leftActive) return 2;
  if (rightActive) return 1;
  return 1; // default
}

/**
 * Recalcula el dynamicDesign de todos los DIENTES que tienen un hallazgo,
 * basándose en los ESPACIOS adyacentes.
 */
export function recalculateToothDesigns(teeth: ToothData[], findingId: number, spaces: SpaceData[]): ToothData[] {
  return teeth.map((tooth) => {
    const findingIdx = tooth.findings.findIndex((f) => f.findingId === findingId);
    if (findingIdx < 0) return tooth;

    const newDesign = calculateToothDesignFromSpaces(tooth.toothId, findingId, spaces);
    const updatedFindings = tooth.findings.map((f, i) => (i === findingIdx ? { ...f, designNumber: newDesign } : f));

    return { ...tooth, findings: updatedFindings };
  });
}

/**
 * Obtiene el dynamicDesign para un hallazgo de diente con design fijo.
 */
export function getFixedDesignNumber(findingId: number): number | null {
  if (FIXED_DESIGN_FINDINGS.has(findingId)) return 1;
  return null;
}

/**
 * Determina si un hallazgo usa lógica de adyacencia.
 */
export function usesAdjacencyLogic(findingId: number): boolean {
  return ADJACENCY_FINDINGS.has(findingId);
}

/**
 * Determina si un hallazgo usa adyacencia diente↔legendSpace (bidireccional).
 * El design del diente depende de los legend spaces adyacentes.
 * El design del legend space depende de los dientes adyacentes.
 */
export function usesToothAdjacencyLogic(findingId: number): boolean {
  return TOOTH_ADJACENCY_FINDINGS.has(findingId);
}

/**
 * Determina si un hallazgo permite múltiples diseños simultáneamente.
 */
export function isMultiDesignFinding(findingId: number): boolean {
  return MULTI_DESIGN_FINDINGS.has(findingId);
}

/**
 * Recalcula el designNumber de todos los DIENTES que tienen un hallazgo
 * basándose en si los LEGEND SPACES adyacentes tienen el hallazgo activo.
 *
 * Patrón idéntico a finding 1 (spacing row) pero sobre legendSpaces.
 *
 * El diente está entre legend spaces:
 *   leftLegendSpace | ToothDetails | rightLegendSpace
 *
 * - leftLegendSpace: el que tiene rightToothId === toothId del diente
 * - rightLegendSpace: el que tiene leftToothId === toothId del diente
 *
 * Diseños:
 * - Ambos legend spaces activos → design 3 (ambos lados conectados)
 * - Solo leftLegendSpace activo  → design 2 (conectado por la izquierda)
 * - Solo rightLegendSpace activo → design 1 (conectado por la derecha)
 * - Ninguno activo               → design 1 (default)
 */
export function recalculateToothDesignsFromLegendSpaces(
  teeth: ToothData[],
  findingId: number,
  legendSpaces: LegendSpaceData[],
): ToothData[] {
  return teeth.map((tooth) => {
    const findingIdx = tooth.findings.findIndex((f) => f.findingId === findingId);
    if (findingIdx < 0) return tooth;

    // Legend space a la IZQUIERDA del diente (el diente es el rightToothId del space)
    const leftLegendSpace = legendSpaces.find((ls) => ls.rightToothId === tooth.toothId);
    // Legend space a la DERECHA del diente (el diente es el leftToothId del space)
    const rightLegendSpace = legendSpaces.find((ls) => ls.leftToothId === tooth.toothId);

    const leftActive = leftLegendSpace != null && leftLegendSpace.findings.some((f) => f.findingId === findingId);
    const rightActive = rightLegendSpace != null && rightLegendSpace.findings.some((f) => f.findingId === findingId);

    let newDesign: number;
    if (leftActive && rightActive) {
      newDesign = 3; // both sides connected
    } else if (leftActive) {
      newDesign = 2; // connected on left
    } else if (rightActive) {
      newDesign = 1; // connected on right
    } else {
      newDesign = 1; // standalone default
    }

    const updatedFindings = tooth.findings.map((f, i) => (i === findingIdx ? { ...f, designNumber: newDesign } : f));
    return { ...tooth, findings: updatedFindings };
  });
}

/**
 * Determina si un hallazgo depende de la posición para su design.
 */
export function usesPositionLogic(findingId: number): boolean {
  return POSITION_DEPENDENT_FINDINGS.has(findingId);
}

/**
 * Determina si un hallazgo es de tipo "row" (se aplica a toda la arcada).
 */
export function isRowFinding(findingId: number): boolean {
  return ROW_FINDINGS.has(findingId);
}

/**
 * Determina si el spacing de un hallazgo es findings-based (vs color-based).
 */
export function isFindingsBasedSpacing(findingId: number): boolean {
  return FINDINGS_BASED_SPACING.has(findingId);
}

/**
 * Determina el designNumber según la posición del diente.
 */
export function getPositionBasedDesign(position: 'upper' | 'lower'): number {
  return position === 'upper' ? 1 : 2;
}

/**
 * Calcula el dynamicDesign para un legendSpace basándose en los DIENTES adyacentes.
 *
 * El SpaceBetweenLegends se encuentra entre leftTooth y rightTooth.
 * Su diseño depende de cuáles de esos dientes tienen el hallazgo activo:
 *
 * - leftTooth tiene hallazgo AND rightTooth tiene hallazgo → design 3 (centro)
 * - Solo leftTooth tiene hallazgo → design 1 (desde la izquierda)
 * - Solo rightTooth tiene hallazgo → design 2 (desde la derecha)
 * - Ninguno → design 1 (default)
 */
export function calculateLegendDesign(
  legendSpaces: { leftToothId: number; rightToothId: number; findings: { findingId: number }[] }[],
  index: number,
  findingId: number,
  teeth?: ToothData[],
): number {
  if (teeth) {
    // Use tooth data for design calculation
    const ls = legendSpaces[index];
    const leftHas = toothHasFinding(teeth, ls.leftToothId, findingId);
    const rightHas = toothHasFinding(teeth, ls.rightToothId, findingId);

    if (leftHas && rightHas) return 3;
    if (leftHas) return 1;
    if (rightHas) return 2;
    return 1; // default
  }

  // Fallback: check adjacent legend spaces (legacy)
  const leftActive = index > 0 && legendSpaces[index - 1].findings.some((f) => f.findingId === findingId);
  const rightActive =
    index < legendSpaces.length - 1 && legendSpaces[index + 1].findings.some((f) => f.findingId === findingId);

  if (leftActive && rightActive) return 3;
  if (leftActive) return 2;
  return 1;
}

/**
 * Recalcula los designs de TODOS los legendSpaces que tienen un hallazgo,
 * basándose en qué DIENTES tienen ese hallazgo activo.
 */
export function recalculateLegendDesigns(
  legendSpaces: LegendSpaceData[],
  findingId: number,
  teeth: ToothData[],
): LegendSpaceData[] {
  return legendSpaces.map((ls, i) => {
    if (!ls.findings.some((f) => f.findingId === findingId)) return ls;
    const newDesign = calculateLegendDesign(legendSpaces, i, findingId, teeth);
    return {
      ...ls,
      findings: ls.findings.map((f) => (f.findingId === findingId ? { ...f, designNumber: newDesign } : f)),
    };
  });
}
