// Configuración centralizada para el odontograma
export const ODONTOGRAM_CONFIG = {
  // Dimensiones estándar
  dimensions: {
    toothWidth: 60,
    toothHeight: 20,
    spacingWidth: 20,
    spacingHeight: 20,
    legendHeight: 20,
  },

  // Estilos comunes
  styles: {
    rowContainer: {
      display: 'flex' as const,
      flexDirection: 'row' as const,
      alignItems: 'flex-end' as const,
    },
    rowContainerUpper: {
      display: 'flex' as const,
      flexDirection: 'row' as const,
      alignItems: 'flex-end' as const,
    },
    rowContainerLower: {
      display: 'flex' as const,
      flexDirection: 'row' as const,
      alignItems: 'flex-start' as const,
    },
    interactiveSvg: {
      cursor: 'pointer',
    },
  },

  // Colores
  colors: {
    selected: 'lightgray',
    default: 'white',
    border: '#ccc',
  },

  // Configuración de accesibilidad
  accessibility: {
    role: 'button',
    tabIndex: 0,
  },
} as const;

// Tipos para la configuración
export interface OdontogramDimensions {
  width: number;
  height: number;
  viewBox: string;
}

export interface FindingRowConfig {
  optionId: number;
  component: React.ComponentType<{ id: string | number }>;
  data: Array<{ id: string | number }>;
  description?: string;
}

// Constantes para hallazgos
export const FINDING_OPTIONS = {
  APARATO_ORTODONTICO_FIJO: 1,
  APARATO_ORTODONTICO_REMOVIBLE: 2,
  GIROVERSION: 13,
  CORONA_TEMPORAL: 24,
  CORONA: 25,
  DIENTE_AUSENTE: 26, // Para hallazgo 26
  MOVILIDAD_PATOLOGICA: 30,
  EDENTULO_TOTAL: 31,
  PIEZA_DENTARIA_AUSENTE: 32,
  TRANSPOSICION_DENTARIA: 39,
} as const;

// Configuración centralizada del odontograma
// Permite cambiar IDs sin romper la funcionalidad

export interface IDMapping {
  teeth: {
    upper: string[]; // IDs de dientes superiores
    lower: string[]; // IDs de dientes inferiores
  };
  spaces: {
    upper: string[]; // IDs de espacios superiores
    lower: string[]; // IDs de espacios inferiores
  };
}

// Mapeo actual de IDs (se puede cambiar fácilmente)
export const ID_MAPPING: IDMapping = {
  teeth: {
    upper: ['11', '12', '13', '14', '15', '16', '17', '18', '21', '22', '23', '24', '25', '26', '27', '28'],
    lower: ['31', '32', '33', '34', '35', '36', '37', '38', '41', '42', '43', '44', '45', '46', '47', '48'],
  },
  spaces: {
    upper: [
      '700000',
      '700001',
      '700002',
      '700003',
      '700004',
      '700005',
      '700006',
      '700007',
      '700008',
      '700009',
      '700010',
      '700011',
      '700012',
      '700013',
      '700014',
    ],
    lower: [
      '5700000',
      '5700001',
      '5700002',
      '5700003',
      '5700004',
      '5700005',
      '5700006',
      '5700007',
      '5700008',
      '5700009',
      '5700010',
      '5700011',
      '5700012',
      '5700013',
      '5700014',
    ],
  },
};

// Utilidades para determinar posición sin depender de rangos numéricos
export const PositionUtils = {
  // Determinar si un ID es de diente superior
  isUpperTooth: (id: string): boolean => {
    return ID_MAPPING.teeth.upper.includes(id);
  },

  // Determinar si un ID es de diente inferior
  isLowerTooth: (id: string): boolean => {
    return ID_MAPPING.teeth.lower.includes(id);
  },

  // Determinar si un ID es de espacio superior
  isUpperSpace: (id: string): boolean => {
    return ID_MAPPING.spaces.upper.includes(id);
  },

  // Determinar si un ID es de espacio inferior
  isLowerSpace: (id: string): boolean => {
    return ID_MAPPING.spaces.lower.includes(id);
  },

  // Obtener la posición de un diente
  getToothPosition: (id: string): 'upper' | 'lower' | null => {
    if (PositionUtils.isUpperTooth(id)) return 'upper';
    if (PositionUtils.isLowerTooth(id)) return 'lower';
    return null;
  },

  // Obtener la posición de un espacio
  getSpacePosition: (id: string): 'upper' | 'lower' | null => {
    if (PositionUtils.isUpperSpace(id)) return 'upper';
    if (PositionUtils.isLowerSpace(id)) return 'lower';
    return null;
  },

  // Obtener todos los IDs de dientes de una posición
  getTeethByPosition: (position: 'upper' | 'lower'): string[] => {
    return ID_MAPPING.teeth[position];
  },

  // Obtener todos los IDs de espacios de una posición
  getSpacesByPosition: (position: 'upper' | 'lower'): string[] => {
    return ID_MAPPING.spaces[position];
  },
};

// Configuración de hallazgos que requieren comportamiento especial
export const FINDING_CONFIG = {
  // Hallazgos que afectan toda una fila
  ROW_FINDINGS: [7, 31],

  // Hallazgos con comportamiento bidireccional
  BIDIRECTIONAL_FINDINGS: [1, 2, 30, 31, 32, 39],

  // Hallazgos que solo se aplican en espacios
  SPACE_ONLY_FINDINGS: [13, 24, 25, 26, 30, 32],

  // Hallazgos que solo se aplican en dientes
  TOOTH_ONLY_FINDINGS: [1, 2, 3, 4, 5, 6, 7, 11, 12, 21, 31],
};

// Función para actualizar el mapeo de IDs (útil para migración a OpenMRS)
export const updateIDMapping = (newMapping: IDMapping) => {
  Object.assign(ID_MAPPING, newMapping);
};

// Función para exportar la configuración actual
export const exportConfig = () => {
  return {
    idMapping: ID_MAPPING,
    findingConfig: FINDING_CONFIG,
  };
};
