/**
 * Tipos públicos del componente Odontograma.
 *
 * Estos tipos definen la interfaz pública que los consumidores del componente
 * usarán para pasar datos (desde BBDD) y recibir cambios (para guardar en BBDD).
 *
 * Patrón de uso:
 * ```tsx
 * const [data, setData] = useState<OdontogramData>(initialData);
 * <Odontogram config={adultConfig} data={data} onChange={setData} />
 * ```
 */

// =============================================================================
// TIPOS PRIMITIVOS
// =============================================================================

/** Color asociado a un hallazgo clínico */
export interface FindingColor {
  id: number;
  name: string; // "blue" | "red"
}

/** Variante de diseño visual de un hallazgo */
export interface FindingDesign {
  number: number;
  nombre: string;
  componente: string; // Nombre del componente SVG (e.g. "Finding5Design1")
  zones?: number | number[]; // Restricción: solo compatible con dientes de N zonas
}

/** Subopción de un hallazgo (e.g. Corona → CM, CF, CMC, CV, CLM) */
export interface FindingSuboption {
  id: number;
  nombre: string;
  descripcion?: string;
}

// =============================================================================
// DATOS PERSISTENTES — Lo que se guarda en BBDD
// =============================================================================

/**
 * Hallazgo clínico aplicado a un diente.
 * Se almacena en `ToothData.findings[]`.
 */
export interface ToothFinding {
  /** ID único del hallazgo registrado (para identificar instancias individuales) */
  id: string;
  /** ID del tipo de hallazgo (1-39) */
  findingId: number;
  /** ID de la subopción seleccionada, si aplica */
  subOptionId?: number;
  /** Color aplicado */
  color: FindingColor;
  /** Número de la variante de diseño visual seleccionada */
  designNumber?: number | null;
}

/**
 * Datos persistentes de un diente individual.
 */
export interface ToothData {
  /** ID FDI del diente (e.g. 18, 11, 21, 48) */
  toothId: number;
  /** Hallazgos clínicos aplicados a este diente */
  findings: ToothFinding[];
  /** Anotaciones auto-generadas (abreviaturas de hallazgos con color) */
  annotations?: ToothAnnotation[];
  /** Texto/notas del diente (textarea) — legacy / manual */
  notes?: string;
}

/**
 * Anotación auto-generada en el recuadro del diente.
 * Cada hallazgo que produce abreviatura genera una entrada.
 */
export interface ToothAnnotation {
  /** ID del hallazgo que originó la anotación */
  findingId: number;
  /** Texto de la abreviatura (e.g. "CM", "FFP", "I") */
  text: string;
  /** Color CSS del texto (e.g. "blue", "red") */
  color: string;
}

/**
 * Hallazgo clínico aplicado a un espacio entre dientes.
 * Hay dos patrones de almacenamiento según el tipo de hallazgo:
 * - Color-based (1, 2, 7, 24, 25, 30, 31, 32): solo `color`
 * - Findings-based (6, 13, 26, 39): `findings[]` con diseño
 */
export interface SpaceFinding {
  /** ID único del hallazgo en el espacio */
  id: string;
  /** ID del tipo de hallazgo (1-39) */
  findingId: number;
  /** Color aplicado (para hallazgos color-based) */
  color: FindingColor;
  /** Número de variante de diseño (calculado por lógica de adyacencia o seleccionado) */
  designNumber?: number | null;
}

/**
 * Datos persistentes de un espacio entre dos dientes adyacentes.
 * Cada tipo de hallazgo de spacing tiene su propio conjunto de espacios.
 */
export interface SpaceData {
  /** ID del diente izquierdo */
  leftToothId: number;
  /** ID del diente derecho */
  rightToothId: number;
  /** Hallazgos aplicados a este espacio */
  findings: SpaceFinding[];
}

/**
 * Datos de los espacios entre leyendas (labels de dientes).
 * Usado para hallazgos que se representan en el área de leyenda (e.g. 11-Fusión).
 */
export interface LegendSpaceData {
  /** ID del diente izquierdo */
  leftToothId: number;
  /** ID del diente derecho */
  rightToothId: number;
  /** Hallazgos aplicados en este espacio de leyenda */
  findings: SpaceFinding[];
}

/**
 * Datos completos del odontograma — LO QUE SE GUARDA EN BBDD.
 *
 * Este es el tipo principal que fluye entre la aplicación y el componente:
 * - Se lee de BBDD → se pasa como prop `data`
 * - El componente emite cambios vía `onChange(newData)`
 * - Se guarda de vuelta en BBDD
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * CONTRATO DE INTEGRACIÓN — IMPORTANTE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Los 5 campos siguientes conforman UNA SOLA UNIDAD CLÍNICA y deben
 * persistirse y restaurarse juntos:
 *
 *   1. `teeth`             → hallazgos por pieza (cara/superficie)
 *   2. `spacingFindings`   → hallazgos entre piezas (diastemas, etc.)
 *   3. `legendSpaces`      → hallazgos en zona de leyendas (fusiones, etc.)
 *   4. `especificaciones`  → texto libre — detalle clínico que el gráfico
 *                            no puede expresar (severidad, material, etc.)
 *   5. `observaciones`     → texto libre — contexto del encuentro
 *                            (síntomas, derivaciones, indicaciones)
 *
 * No persistir uno sin los otros: el odontograma clínico vive como un
 * único registro completo. Tanto al guardar como al cargar, el round-trip
 * debe preservar los 5 campos.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */
export interface OdontogramData {
  /** Datos de cada diente con sus hallazgos */
  teeth: ToothData[];

  /**
   * Hallazgos en los espacios entre dientes, agrupados por findingId.
   * Ejemplo: { 1: [...spaces], 30: [...spaces] }
   * Solo incluye entries para findings que tienen espacios activos.
   */
  spacingFindings: Record<number, SpaceData[]>;

  /**
   * Hallazgos en los espacios entre leyendas (área de labels).
   * Usado por hallazgos como 11 (Fusión).
   */
  legendSpaces: LegendSpaceData[];

  /** Texto libre de especificaciones — viaja siempre con el odontograma.
   *  Ver OdontogramTextFields.tsx para la guía clínica de uso. */
  especificaciones?: string;

  /** Texto libre de observaciones — viaja siempre con el odontograma.
   *  Ver OdontogramTextFields.tsx para la guía clínica de uso. */
  observaciones?: string;
}

// =============================================================================
// CONFIGURACIÓN DEL ODONTOGRAMA
// =============================================================================

export type ToothPosition = 'upper' | 'lower';
export type ToothType = 'molar' | 'premolar' | 'canino' | 'incisivo';
export type ToothRootDesign = 'default' | 'design2' | 'design3' | 'design4';

/**
 * Definición de un diente en la configuración del odontograma.
 * Define las propiedades estructurales (no cambian con hallazgos).
 */
export interface ToothConfig {
  /** ID FDI del diente */
  id: number;
  /** Posición en la arcada */
  position: ToothPosition;
  /** Tipo de diente */
  type: ToothType;
  /** Número de zonas del diente (4, 6 u 8) */
  zones: number;
  /** Diseño visual de la raíz ("default" = 3 raíces, "design2" = 1 raíz, etc.) */
  rootDesign: ToothRootDesign;
}

/**
 * IDs de los hallazgos que se renderizan en filas de spacing entre dientes.
 * El orden define el orden de las filas en el renderizado.
 */
export type SpacingFindingId = number;

/**
 * Configuración completa de un tipo de odontograma (adulto o infantil).
 *
 * Esto define la ESTRUCTURA — no los datos. Es inmutable.
 * El componente usa esta config para saber cuántos dientes renderizar,
 * qué filas de hallazgos mostrar, etc.
 */
export interface OdontogramConfig {
  /** Identificador del tipo de odontograma */
  type: 'adult' | 'child';
  /** Nombre descriptivo */
  name: string;
  /** Definición de todos los dientes (ordenados como se renderizan) */
  teeth: {
    upper: ToothConfig[];
    lower: ToothConfig[];
  };
  /** IDs de hallazgos que requieren filas de spacing (ordenado = orden visual) */
  spacingFindingIds: SpacingFindingId[];
  /** Catálogo completo de hallazgos clínicos disponibles */
  findingOptions: FindingOptionConfig[];
}

/**
 * Configuración de un hallazgo clínico del catálogo.
 * Define el COMPORTAMIENTO y opciones disponibles — no el estado.
 */
export interface FindingOptionConfig {
  /** ID del hallazgo (1-39) */
  id: number;
  /** Nombre del hallazgo */
  nombre: string;
  /** Abreviatura (e.g. "CT", "IMP", "RR") */
  identificador?: string;
  /** Colores permitidos */
  colores: FindingColor[];
  /** Subopciones disponibles */
  subopciones?: FindingSuboption[];
  /** Variantes de diseño visual disponibles */
  designs?: FindingDesign[];
  /** Fuente de la abreviatura para el recuadro del diente */
  abreviaturaSource?: 'none' | 'tipo' | 'identificador';
  /** Categoría de renderizado */
  renderCategory: FindingRenderCategory;
  /** Si se aplica a toda la fila (todos los dientes de la misma posición) */
  appliesToRow?: boolean;
}

/**
 * Categoría que determina DÓNDE se renderiza un hallazgo:
 * - "on-tooth": sobre el SVG del diente (click en diente)
 * - "spacing-row": en fila de espacios entre dientes (click en celda de fila)
 * - "legend": en el área de leyenda/label del diente (click en label)
 * - "text-only": solo texto en textarea, sin visual SVG
 */
export type FindingRenderCategory = 'on-tooth' | 'spacing-row' | 'legend' | 'text-only';

// =============================================================================
// PROPS PÚBLICOS DEL COMPONENTE
// =============================================================================

/**
 * Props del componente `<Odontogram>`.
 * Sigue el patrón de componente controlado:
 * - `data` = estado actual (leído de BBDD)
 * - `onChange` = callback cuando el usuario modifica algo
 * - Sin `onChange` = modo solo lectura
 */
export interface OdontogramProps {
  /** Configuración estructural (adulto/infantil) */
  config: OdontogramConfig;
  /** Datos actuales del odontograma (hallazgos registrados) */
  data: OdontogramData;
  /** Callback al modificar datos. Si no se provee, el componente es read-only. */
  onChange?: (data: OdontogramData) => void;
  /** Clase CSS adicional para el contenedor raíz */
  className?: string;
  /** Si se muestra el formulario para seleccionar hallazgos */
  showForm?: boolean;
}

// =============================================================================
// FACTORY DE DATOS VACÍOS
// =============================================================================

/**
 * Crea un OdontogramData vacío a partir de una configuración.
 * Útil para inicializar un odontograma nuevo en BBDD.
 */
export function createEmptyOdontogramData(config: OdontogramConfig): OdontogramData {
  const allTeeth = [...config.teeth.upper, ...config.teeth.lower];

  const teeth: ToothData[] = allTeeth.map((t) => ({
    toothId: t.id,
    findings: [],
    notes: '',
  }));

  // Crear espacios vacíos para cada finding de spacing
  const spacingFindings: Record<number, SpaceData[]> = {};
  for (const findingId of config.spacingFindingIds) {
    spacingFindings[findingId] = [];
    for (const position of ['upper', 'lower'] as const) {
      const posTeeth = config.teeth[position];
      for (let i = 0; i < posTeeth.length - 1; i++) {
        spacingFindings[findingId].push({
          leftToothId: posTeeth[i].id,
          rightToothId: posTeeth[i + 1].id,
          findings: [],
        });
      }
    }
  }

  // Crear espacios de leyenda vacíos
  const legendSpaces: LegendSpaceData[] = [];
  for (const position of ['upper', 'lower'] as const) {
    const posTeeth = config.teeth[position];
    for (let i = 0; i < posTeeth.length - 1; i++) {
      legendSpaces.push({
        leftToothId: posTeeth[i].id,
        rightToothId: posTeeth[i + 1].id,
        findings: [],
      });
    }
  }

  return { teeth, spacingFindings, legendSpaces, especificaciones: '', observaciones: '' };
}
