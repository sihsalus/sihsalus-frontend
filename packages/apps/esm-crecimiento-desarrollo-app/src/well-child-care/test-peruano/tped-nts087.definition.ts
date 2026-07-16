export const TPED_INSTRUMENT_ID = 'TPED-NTS087-2010' as const;
export const TPED_NORMATIVE_STATUS = 'legacy' as const;

export const TPED_AGE_COLUMNS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 18, 21, 24, 30] as const;

export type TpedAgeColumn = (typeof TPED_AGE_COLUMNS)[number];
export type TpedLineCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L';
export type TpedDomain = 'motorPostural' | 'visoMotor' | 'language' | 'personalSocial' | 'intelligenceLearning';
export type TpedEvidence = 'observed' | 'reported' | 'observedOrReported';

export interface TpedMilestoneDefinition {
  code: string;
  lineCode: TpedLineCode;
  ageMonths: TpedAgeColumn;
  title: string;
  evidence: TpedEvidence;
  sourcePdfPage: number;
  conceptUuid: string | null;
}

export interface TpedLineDefinition {
  code: TpedLineCode;
  domain: TpedDomain;
  title: string;
  sourcePdfPage: number;
  milestones: readonly TpedMilestoneDefinition[];
}

type TpedMilestoneSeed = readonly [ageMonths: TpedAgeColumn, title: string, evidence: TpedEvidence];

function defineLine({
  code,
  domain,
  milestones,
  sourcePdfPage,
  title,
}: {
  code: TpedLineCode;
  domain: TpedDomain;
  milestones: readonly TpedMilestoneSeed[];
  sourcePdfPage: number;
  title: string;
}): TpedLineDefinition {
  return {
    code,
    domain,
    title,
    sourcePdfPage,
    milestones: milestones.map(([ageMonths, milestoneTitle, evidence]) => ({
      code: `${code}${ageMonths}`,
      lineCode: code,
      ageMonths,
      title: milestoneTitle,
      evidence,
      sourcePdfPage,
      conceptUuid: null,
    })),
  };
}

export const TPED_LINES = [
  defineLine({
    code: 'A',
    domain: 'motorPostural',
    title: 'Control de cabeza y tronco sentado',
    sourcePdfPage: 93,
    milestones: [
      [1, 'Movimientos asimétricos de brazos y piernas', 'observed'],
      [3, 'La cabeza acompaña al movimiento del tronco, no cae', 'observed'],
      [5, 'Dorso recto, apoyo hacia delante con descarga de peso', 'observed'],
      [7, 'Sentado sin apoyo', 'observed'],
      [18, 'Sentado en el suelo, se para solo', 'observed'],
    ],
  }),
  defineLine({
    code: 'B',
    domain: 'motorPostural',
    title: 'Control de cabeza y tronco, rotaciones',
    sourcePdfPage: 94,
    milestones: [
      [1, 'Levanta la cabeza por momentos', 'observed'],
      [3, 'Apoyo inestable sobre antebrazos', 'observed'],
      [6, 'Gira sobre su cuerpo fácilmente', 'observed'],
    ],
  }),
  defineLine({
    code: 'C',
    domain: 'motorPostural',
    title: 'Control de cabeza y tronco, marcha',
    sourcePdfPage: 94,
    milestones: [
      [1, 'Puesto de pie extiende las piernas', 'observed'],
      [2, 'Parado no sostiene el peso de su cuerpo', 'observed'],
      [5, 'Comienza a pararse', 'observed'],
      [10, 'Camina apoyándose en las cosas', 'observedOrReported'],
      [12, 'Camina solo con pobre equilibrio y piernas separadas', 'observed'],
      [18, 'Corre', 'observedOrReported'],
    ],
  }),
  defineLine({
    code: 'D',
    domain: 'visoMotor',
    title: 'Uso del brazo y mano',
    sourcePdfPage: 95,
    milestones: [
      [1, 'Aprieta cualquier objeto colocado en su mano', 'observed'],
      [3, 'Manos abiertas, abre brazos ante objeto', 'observed'],
      [4, 'Une sus brazos en línea media y toma un objeto con ambas manos', 'observed'],
      [6, 'Coge un objeto en cada mano', 'observed'],
      [8, 'Pinza índice-pulgar torpe', 'observed'],
      [11, 'Pinza fina', 'observed'],
      [15, 'Mete un frijol en un frasco', 'observed'],
      [18, 'Hace torres de 3 cubos', 'observed'],
      [21, 'Hace torres de 5 cubos', 'observed'],
      [24, 'Hace torres de 7 cubos', 'observed'],
      [30, 'Hace puente de 3 cubos', 'observed'],
    ],
  }),
  defineLine({
    code: 'E',
    domain: 'visoMotor',
    title: 'Visión',
    sourcePdfPage: 96,
    milestones: [
      [1, 'Frunce el ceño y rechaza con parpadeo la luz intensa', 'observed'],
      [2, 'Sigue con la mirada objetos sin sonido en ángulo de 90°', 'observed'],
      [3, 'Sigue con la mirada objetos cercanos sin sonido en un ángulo de 180°', 'observed'],
    ],
  }),
  defineLine({
    code: 'F',
    domain: 'language',
    title: 'Audición',
    sourcePdfPage: 96,
    milestones: [
      [1, 'Detiene sus movimientos al oír un sonido', 'observed'],
      [3, 'Voltea al oír sonido de la campana', 'observed'],
      [6, 'Localiza, diferencia y reacciona ante diferentes sonidos con movimientos completos de cabeza', 'observed'],
    ],
  }),
  defineLine({
    code: 'G',
    domain: 'language',
    title: 'Lenguaje comprensivo',
    sourcePdfPage: 97,
    milestones: [
      [1, 'Sonríe con la voz de su madre', 'observedOrReported'],
      [5, 'Reconoce su nombre', 'observed'],
      [6, 'Comprende «upa», «ven», «chau»', 'observed'],
      [9, 'Comprende el «No»', 'observedOrReported'],
      [11, 'Responde a una orden simple e identifica objetos', 'observed'],
      [18, 'Distingue entre tú y yo', 'observed'],
      [21, 'Comprende dos frases sencillas consecutivas', 'observed'],
      [24, 'Comprende tres frases', 'observed'],
      [30, 'Pasa página, elige figura del libro y las nomina', 'observed'],
    ],
  }),
  defineLine({
    code: 'H',
    domain: 'language',
    title: 'Lenguaje expresivo',
    sourcePdfPage: 98,
    milestones: [
      [1, 'Llora por una causa: hambre, frío o sueño', 'reported'],
      [2, 'Emite sonidos o «agú» cuando se le habla', 'observedOrReported'],
      [5, 'Se repite a sí mismo y en respuesta a los demás', 'observedOrReported'],
      [7, 'Dice «pa-pa», «ma-ma» a cualquier persona', 'observedOrReported'],
      [10, 'Dice «papá», «mamá»', 'observedOrReported'],
      [12, 'Dice dos palabras sueltas, además de papá y mamá', 'observedOrReported'],
      [18, 'Palabras-frase: «mamá teta»', 'observedOrReported'],
      [24, 'Dice oraciones simples', 'observedOrReported'],
    ],
  }),
  defineLine({
    code: 'I',
    domain: 'personalSocial',
    title: 'Comportamiento social',
    sourcePdfPage: 99,
    milestones: [
      [1, 'Cuando llora se tranquiliza al ser alzado o acariciado', 'observedOrReported'],
      [2, 'Sonríe ante cualquier rostro', 'observed'],
      [3, 'Responde diferente a la voz molesta y a la voz alegre', 'reported'],
      [6, 'Toca su imagen en el espejo', 'observed'],
      [8, 'Llama o grita para establecer contacto con otros', 'reported'],
      [11, 'Imita gestos', 'observedOrReported'],
      [12, 'Ofrece un juguete', 'observedOrReported'],
      [15, 'Come en la mesa con los demás', 'reported'],
      [18, 'Imita tareas simples de la casa', 'reported'],
      [24, 'Desenrosca un tapón para mirar dentro', 'observed'],
      [30, 'Intenta enroscar', 'observed'],
    ],
  }),
  defineLine({
    code: 'J',
    domain: 'personalSocial',
    title: 'Alimentación, vestido e higiene',
    sourcePdfPage: 100,
    milestones: [
      [1, 'Chupa', 'observedOrReported'],
      [5, 'Lleva a la boca algo que se le pone en la mano', 'reported'],
      [6, 'Bebe del vaso con ayuda', 'reported'],
      [11, 'Come del plato con sus manos', 'reported'],
      [12, 'Forcejea hasta quitarse los zapatos', 'reported'],
      [18, 'Avisa sus necesidades', 'reported'],
      [21, 'Intenta quitarse prendas inferiores', 'reported'],
      [30, 'Se pone alguna ropa', 'reported'],
    ],
  }),
  defineLine({
    code: 'K',
    domain: 'personalSocial',
    title: 'Juego',
    sourcePdfPage: 101,
    milestones: [
      [3, 'Juega con sus manos', 'observedOrReported'],
      [4, 'Lleva los juguetes a la boca', 'observedOrReported'],
      [5, 'Juega con sus manos y pies', 'observedOrReported'],
      [6, 'Coge y golpea objetos y repite seriadamente el golpe', 'observedOrReported'],
      [8, 'Lanza objetos a cierta distancia y disfruta con el sonido', 'observedOrReported'],
      [11, 'Sujeto de la mano, empuja la pelota con el pie', 'observed'],
      [15, 'Arrastra juguetes', 'observedOrReported'],
      [18, 'Defiende su juguete', 'reported'],
      [21, 'Juega con otros niños', 'reported'],
      [30, 'Juego social: sabe esperar su turno', 'observed'],
    ],
  }),
  defineLine({
    code: 'L',
    domain: 'intelligenceLearning',
    title: 'Inteligencia y aprendizaje',
    sourcePdfPage: 102,
    milestones: [
      [1, 'Demuestra estar atento', 'observed'],
      [2, 'Al contacto con un objeto abre y cierra la mano', 'observed'],
      [3, 'Se alegra cuando le van a dar el pecho', 'reported'],
      [6, 'Mira cuando cae un objeto', 'observed'],
      [9, 'Encuentra objetos ocultos', 'observed'],
      [10, 'Busca el juguete en la caja', 'observed'],
      [11, 'Explora su juguete', 'observed'],
      [12, 'Hace garabatos', 'observed'],
      [15, 'Identifica figuras de objetos comunes', 'observed'],
      [18, 'Utiliza un objeto para alcanzar otro', 'observedOrReported'],
      [30, 'Coloca los aros en orden de tamaño', 'observed'],
    ],
  }),
] as const;

export const TPED_MILESTONES = TPED_LINES.flatMap((line) => line.milestones);

export const TPED_DEFINITION = {
  id: TPED_INSTRUMENT_ID,
  title: 'Test Peruano de Evaluación del Desarrollo del Niño',
  normativeStatus: TPED_NORMATIVE_STATUS,
  supportedAgeMonths: { min: 0, max: 30 },
  ageColumns: TPED_AGE_COLUMNS,
  source: {
    resolution: 'RM N.° 990-2010/MINSA',
    norm: 'NTS N.° 087-MINSA/DGSP-V.01',
    annex: 9,
    instrumentPdfPage: 88,
    procedurePdfPages: { start: 89, end: 118 },
  },
  lines: TPED_LINES,
} as const;

export function resolveTpedChronologicalMonth(completedCalendarMonths: number, remainingDays: number): number {
  if (!Number.isInteger(completedCalendarMonths) || completedCalendarMonths < 0) {
    throw new RangeError('completedCalendarMonths must be a non-negative integer');
  }

  if (!Number.isInteger(remainingDays) || remainingDays < 0 || remainingDays > 30) {
    throw new RangeError('remainingDays must be an integer between 0 and 30');
  }

  return completedCalendarMonths + (remainingDays >= 29 ? 1 : 0);
}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function parseIsoDate(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);

  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    return null;
  }

  return timestamp;
}

export function calculateTpedChronologicalMonthAtDate(birthDate: string, evaluationDate: string): number | null {
  const birthTimestamp = parseIsoDate(birthDate);
  const evaluationTimestamp = parseIsoDate(evaluationDate);

  if (birthTimestamp === null || evaluationTimestamp === null || evaluationTimestamp < birthTimestamp) {
    return null;
  }

  const elapsedDays = Math.floor((evaluationTimestamp - birthTimestamp) / MILLISECONDS_PER_DAY);

  // NTS 087: one month and 28 days remains in the same month; at 29 days it advances.
  return Math.floor((elapsedDays + 1) / 30);
}

export function resolveTpedEvaluationAgeColumn(chronologicalMonth: number): TpedAgeColumn | null {
  if (!Number.isInteger(chronologicalMonth) || chronologicalMonth < 1 || chronologicalMonth > 30) {
    return null;
  }

  if (chronologicalMonth <= 12) {
    return chronologicalMonth as TpedAgeColumn;
  }

  if (chronologicalMonth <= 14) return 12;
  if (chronologicalMonth <= 17) return 15;
  if (chronologicalMonth <= 20) return 18;
  if (chronologicalMonth <= 23) return 21;
  if (chronologicalMonth <= 29) return 24;
  return 30;
}

export function getTpedStartingAgeColumn(ageColumn: TpedAgeColumn): TpedAgeColumn {
  const index = TPED_AGE_COLUMNS.indexOf(ageColumn);
  return index > 0 ? TPED_AGE_COLUMNS[index - 1] : ageColumn;
}

export function getEffectiveTpedMilestone(
  lineCode: TpedLineCode,
  ageColumn: TpedAgeColumn,
): TpedMilestoneDefinition | null {
  const line = TPED_LINES.find((candidate) => candidate.code === lineCode);
  if (!line) {
    return null;
  }

  let effectiveMilestone: TpedMilestoneDefinition | null = null;
  for (const milestone of line.milestones) {
    if (milestone.ageMonths > ageColumn) {
      break;
    }
    effectiveMilestone = milestone;
  }

  return effectiveMilestone;
}
