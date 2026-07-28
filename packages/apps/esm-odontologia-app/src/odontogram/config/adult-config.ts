/**
 * Configuración del odontograma de adulto (32 dientes).
 *
 * Define la estructura: qué dientes hay, qué tipo son,
 * cuántas zonas tiene cada uno, y qué hallazgos de spacing mostrar.
 */

import optionsData from '../data/optionsData.json';
import type { FindingOptionConfig, OdontogramConfig, ToothConfig } from '../types/odontogram';

// =============================================================================
// DIENTES SUPERIORES (18 → 11, 21 → 28)
// =============================================================================

const upperTeeth: ToothConfig[] = [
  { id: 18, position: 'upper', type: 'molar', zones: 8, rootDesign: 'default' },
  { id: 17, position: 'upper', type: 'molar', zones: 8, rootDesign: 'default' },
  { id: 16, position: 'upper', type: 'molar', zones: 8, rootDesign: 'default' },
  { id: 15, position: 'upper', type: 'premolar', zones: 6, rootDesign: 'design2' },
  { id: 14, position: 'upper', type: 'premolar', zones: 6, rootDesign: 'design2' },
  { id: 13, position: 'upper', type: 'canino', zones: 4, rootDesign: 'design2' },
  { id: 12, position: 'upper', type: 'incisivo', zones: 4, rootDesign: 'design2' },
  { id: 11, position: 'upper', type: 'incisivo', zones: 4, rootDesign: 'design2' },
  { id: 21, position: 'upper', type: 'incisivo', zones: 4, rootDesign: 'design2' },
  { id: 22, position: 'upper', type: 'incisivo', zones: 4, rootDesign: 'design2' },
  { id: 23, position: 'upper', type: 'canino', zones: 4, rootDesign: 'design2' },
  { id: 24, position: 'upper', type: 'premolar', zones: 6, rootDesign: 'design2' },
  { id: 25, position: 'upper', type: 'premolar', zones: 6, rootDesign: 'design2' },
  { id: 26, position: 'upper', type: 'molar', zones: 8, rootDesign: 'default' },
  { id: 27, position: 'upper', type: 'molar', zones: 8, rootDesign: 'default' },
  { id: 28, position: 'upper', type: 'molar', zones: 8, rootDesign: 'default' },
];

// =============================================================================
// DIENTES INFERIORES (48 → 41, 31 → 38)
// =============================================================================

const lowerTeeth: ToothConfig[] = [
  { id: 48, position: 'lower', type: 'molar', zones: 8, rootDesign: 'default' },
  { id: 47, position: 'lower', type: 'molar', zones: 8, rootDesign: 'default' },
  { id: 46, position: 'lower', type: 'molar', zones: 8, rootDesign: 'default' },
  { id: 45, position: 'lower', type: 'premolar', zones: 6, rootDesign: 'design2' },
  { id: 44, position: 'lower', type: 'premolar', zones: 6, rootDesign: 'design2' },
  { id: 43, position: 'lower', type: 'canino', zones: 4, rootDesign: 'design2' },
  { id: 42, position: 'lower', type: 'incisivo', zones: 4, rootDesign: 'design2' },
  { id: 41, position: 'lower', type: 'incisivo', zones: 4, rootDesign: 'design2' },
  { id: 31, position: 'lower', type: 'incisivo', zones: 4, rootDesign: 'design2' },
  { id: 32, position: 'lower', type: 'incisivo', zones: 4, rootDesign: 'design2' },
  { id: 33, position: 'lower', type: 'canino', zones: 4, rootDesign: 'design2' },
  { id: 34, position: 'lower', type: 'premolar', zones: 6, rootDesign: 'design2' },
  { id: 35, position: 'lower', type: 'premolar', zones: 6, rootDesign: 'design2' },
  { id: 36, position: 'lower', type: 'molar', zones: 8, rootDesign: 'default' },
  { id: 37, position: 'lower', type: 'molar', zones: 8, rootDesign: 'default' },
  { id: 38, position: 'lower', type: 'molar', zones: 8, rootDesign: 'default' },
];

// =============================================================================
// HALLAZGOS DE SPACING (orden visual de las filas)
// =============================================================================

/**
 * IDs de hallazgos que se muestran como filas de spacing entre dientes.
 * El orden aquí determina el orden de las filas en el renderizado.
 */
const spacingFindingIds = [1, 2, 13, 24, 25, 26, 30, 31, 32, 39, 6, 7];

// =============================================================================
// CATÁLOGO DE HALLAZGOS
// =============================================================================

/**
 * Mapeo de categoría de renderizado por ID de hallazgo.
 * Determina DÓNDE se renderiza cada hallazgo.
 */
const RENDER_CATEGORIES: Record<number, FindingOptionConfig['renderCategory']> = {
  // On-tooth (se dibujan sobre el SVG del diente)
  3: 'on-tooth',
  4: 'on-tooth',
  5: 'on-tooth',
  8: 'on-tooth',
  10: 'on-tooth',
  16: 'on-tooth',
  20: 'on-tooth',
  23: 'on-tooth',
  27: 'on-tooth',
  28: 'on-tooth',
  34: 'on-tooth',
  35: 'on-tooth',
  36: 'on-tooth',
  37: 'on-tooth',
  38: 'on-tooth',

  // Spacing-row (en filas entre dientes)
  1: 'spacing-row',
  2: 'spacing-row',
  6: 'spacing-row',
  7: 'spacing-row',
  13: 'spacing-row',
  24: 'spacing-row',
  25: 'spacing-row',
  26: 'spacing-row',
  30: 'spacing-row',
  31: 'spacing-row',
  32: 'spacing-row',
  39: 'spacing-row',

  // Legend-area (en el label del diente)
  11: 'legend',
  12: 'legend',
  21: 'legend',

  // Text-only (sin visual SVG)
  9: 'text-only',
  14: 'text-only',
  15: 'text-only',
  17: 'text-only',
  18: 'text-only',
  19: 'text-only',
  22: 'text-only',
  29: 'text-only',
  33: 'text-only',
};

/** Hallazgos que se aplican a toda la fila */
const ROW_FINDINGS = new Set([7, 31]);

/**
 * Construye el catálogo de FindingOptionConfig a partir de optionsData.json.
 */
function buildFindingOptions(): FindingOptionConfig[] {
  return (
    optionsData.opciones as Array<{
      id: number;
      nombre: string;
      identificador?: string;
      colores?: FindingOptionConfig['colores'];
      subopciones?: FindingOptionConfig['subopciones'];
      designs?: FindingOptionConfig['designs'];
      abreviaturaSource?: FindingOptionConfig['abreviaturaSource'];
    }>
  ).map((opt) => ({
    id: opt.id,
    nombre: opt.nombre,
    identificador: opt.identificador,
    colores: opt.colores || [],
    subopciones: opt.subopciones,
    designs: opt.designs,
    abreviaturaSource: opt.abreviaturaSource || 'none',
    renderCategory: RENDER_CATEGORIES[opt.id] || 'text-only',
    appliesToRow: ROW_FINDINGS.has(opt.id),
  }));
}

// =============================================================================
// CONFIGURACIÓN EXPORTADA
// =============================================================================

export const adultConfig: OdontogramConfig = {
  type: 'adult',
  name: 'Odontograma de Adulto',
  teeth: {
    upper: upperTeeth,
    lower: lowerTeeth,
  },
  spacingFindingIds,
  findingOptions: buildFindingOptions(),
};
