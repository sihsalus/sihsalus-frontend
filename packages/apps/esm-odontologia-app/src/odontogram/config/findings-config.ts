/**
 * Configuración centralizada de hallazgos clínicos
 * Mapeo de optionIds a nombres descriptivos y configuración
 */

export interface FindingConfig {
  id: number;
  name: string;
  hasSpacing: boolean;
  hasZones: boolean;
  hasDesigns: boolean;
  applyToRow?: boolean; // Si aplica a toda la fila de dientes
}

/**
 * Configuración de todos los 39 hallazgos clínicos
 */
export const FINDINGS_CONFIG: Record<number, FindingConfig> = {
  1: { id: 1, name: 'Aparato ortodóntico fijo', hasSpacing: true, hasZones: false, hasDesigns: false },
  2: { id: 2, name: 'Aparato ortodóntico removible', hasSpacing: true, hasZones: false, hasDesigns: false },
  3: { id: 3, name: 'Corona', hasSpacing: false, hasZones: false, hasDesigns: false },
  4: { id: 4, name: 'Corona temporal', hasSpacing: false, hasZones: false, hasDesigns: false },
  5: { id: 5, name: 'Defectos del desarrollo del esmalte', hasSpacing: false, hasZones: true, hasDesigns: true },
  6: { id: 6, name: 'Diastema', hasSpacing: true, hasZones: false, hasDesigns: false },
  7: {
    id: 7,
    name: 'Edéntulo total superior / inferior',
    hasSpacing: true,
    hasZones: false,
    hasDesigns: false,
    applyToRow: true,
  },
  8: { id: 8, name: 'Espigo - Muñón', hasSpacing: false, hasZones: false, hasDesigns: true },
  9: { id: 9, name: 'Fosas y fisuras profundas', hasSpacing: false, hasZones: false, hasDesigns: false },
  10: { id: 10, name: 'Fractura dental', hasSpacing: false, hasZones: true, hasDesigns: true },
  11: { id: 11, name: 'Implante', hasSpacing: false, hasZones: false, hasDesigns: true },
  12: { id: 12, name: 'Lesión en furca', hasSpacing: false, hasZones: false, hasDesigns: true },
  13: { id: 13, name: 'Giroversión', hasSpacing: true, hasZones: false, hasDesigns: false },
  14: { id: 14, name: 'Diente en erupción', hasSpacing: false, hasZones: false, hasDesigns: false },
  15: { id: 15, name: 'Diente ectópico', hasSpacing: false, hasZones: false, hasDesigns: false },
  16: { id: 16, name: 'Diente impactado', hasSpacing: false, hasZones: false, hasDesigns: false },
  17: { id: 17, name: 'Diente supernumerario', hasSpacing: false, hasZones: false, hasDesigns: false },
  18: { id: 18, name: 'Macrodoncia', hasSpacing: false, hasZones: false, hasDesigns: false },
  19: { id: 19, name: 'Microdoncia', hasSpacing: false, hasZones: false, hasDesigns: false },
  20: { id: 20, name: 'Fusión dental', hasSpacing: false, hasZones: false, hasDesigns: false },
  21: { id: 21, name: 'Desgaste dental patológico', hasSpacing: false, hasZones: false, hasDesigns: true },
  22: { id: 22, name: 'Hipoplasia del esmalte', hasSpacing: false, hasZones: false, hasDesigns: false },
  23: { id: 23, name: 'Restauración defectuosa', hasSpacing: false, hasZones: true, hasDesigns: false },
  24: { id: 24, name: 'Corona temporal', hasSpacing: true, hasZones: false, hasDesigns: false },
  25: { id: 25, name: 'Corona', hasSpacing: true, hasZones: false, hasDesigns: true },
  26: { id: 26, name: 'Diente ausente', hasSpacing: true, hasZones: false, hasDesigns: false },
  27: { id: 27, name: 'Puente', hasSpacing: false, hasZones: false, hasDesigns: false },
  28: { id: 28, name: 'PPR', hasSpacing: false, hasZones: false, hasDesigns: false },
  29: { id: 29, name: 'PPT', hasSpacing: false, hasZones: false, hasDesigns: false },
  30: { id: 30, name: 'Movilidad patológica', hasSpacing: true, hasZones: false, hasDesigns: false },
  31: { id: 31, name: 'Edéntulo total', hasSpacing: true, hasZones: false, hasDesigns: false, applyToRow: true },
  32: { id: 32, name: 'Pieza dentaria ausente', hasSpacing: true, hasZones: false, hasDesigns: false },
  33: { id: 33, name: 'Restauración temporal', hasSpacing: false, hasZones: true, hasDesigns: false },
  34: { id: 34, name: 'Resto radicular', hasSpacing: false, hasZones: false, hasDesigns: false },
  35: { id: 35, name: 'Sellante', hasSpacing: false, hasZones: false, hasDesigns: false },
  36: { id: 36, name: 'Tratamiento pulpar', hasSpacing: false, hasZones: false, hasDesigns: false },
  37: { id: 37, name: 'Caries dental', hasSpacing: false, hasZones: true, hasDesigns: false },
  38: { id: 38, name: 'Obturación', hasSpacing: false, hasZones: true, hasDesigns: false },
  39: { id: 39, name: 'Transposición dentaria', hasSpacing: true, hasZones: false, hasDesigns: false },
};

/**
 * Obtiene la configuración de un hallazgo por su ID
 */
export const getFindingConfig = (optionId: number): FindingConfig | undefined => {
  return FINDINGS_CONFIG[optionId];
};

/**
 * Verifica si un hallazgo tiene espaciado entre dientes
 */
export const hasSpacing = (optionId: number): boolean => {
  return FINDINGS_CONFIG[optionId]?.hasSpacing || false;
};

/**
 * Verifica si un hallazgo se aplica a zonas específicas del diente
 */
export const hasZones = (optionId: number): boolean => {
  return FINDINGS_CONFIG[optionId]?.hasZones || false;
};

/**
 * Verifica si un hallazgo tiene múltiples diseños
 */
export const hasDesigns = (optionId: number): boolean => {
  return FINDINGS_CONFIG[optionId]?.hasDesigns || false;
};

/**
 * Verifica si un hallazgo se aplica a toda una fila de dientes
 */
export const applyToRow = (optionId: number): boolean => {
  return FINDINGS_CONFIG[optionId]?.applyToRow || false;
};

/**
 * Obtiene todos los hallazgos que tienen espaciado
 */
export const getFindingsWithSpacing = (): FindingConfig[] => {
  return Object.values(FINDINGS_CONFIG).filter((config) => config.hasSpacing);
};

/**
 * Obtiene todos los hallazgos que tienen zonas
 */
export const getFindingsWithZones = (): FindingConfig[] => {
  return Object.values(FINDINGS_CONFIG).filter((config) => config.hasZones);
};

/**
 * Obtiene todos los hallazgos que tienen diseños
 */
export const getFindingsWithDesigns = (): FindingConfig[] => {
  return Object.values(FINDINGS_CONFIG).filter((config) => config.hasDesigns);
};
