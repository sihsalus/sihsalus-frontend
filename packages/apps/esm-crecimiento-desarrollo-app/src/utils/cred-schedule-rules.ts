import dayjs from 'dayjs';

export type CREDPhase = 'neonatal' | 'infant' | 'toddler' | 'preschool' | 'school';

export interface CREDControlDefinition {
  controlNumber: number;
  label: string;
  targetAgeDays: number;
  ageGroupLabel: string;
  phase: CREDPhase;
}

export interface CREDScheduledControl extends CREDControlDefinition {
  targetDate: Date;
}

/**
 * NTS 238-MINSA/DGIESP-2025: 27 controles CRED desde recién nacido
 * hasta 11 años, 11 meses y 29 días.
 *
 * Neonatal (3): 3-6d, 7-14d, 14-21d
 * 29 días-11 meses (7): 1m, 2m, 3m, 4m, 6m, 7m, 9m
 * 1 año (4): 12m, 15m, 18m, 21m
 * 2-4 años (6): 24m, 30m, 36m, 42m, 48m, 54m
 * 5-11 años (7): anual de 5a a 11a
 */
const CRED_CONTROL_DEFINITIONS: CREDControlDefinition[] = [
  // Recién nacido (3 controles)
  { controlNumber: 1, label: 'RN - 3 a 6 días', targetAgeDays: 3, ageGroupLabel: 'RN - 3 a 6d', phase: 'neonatal' },
  { controlNumber: 2, label: 'RN - 7 a 14 días', targetAgeDays: 7, ageGroupLabel: 'RN - 7 a 14d', phase: 'neonatal' },
  {
    controlNumber: 3,
    label: 'RN - 14 a 21 días',
    targetAgeDays: 14,
    ageGroupLabel: 'RN - 14 a 21d',
    phase: 'neonatal',
  },

  // 29 días a 11 meses y 29 días (7 controles)
  { controlNumber: 4, label: '1 mes', targetAgeDays: 30, ageGroupLabel: '0 AÑOS', phase: 'infant' },
  { controlNumber: 5, label: '2 meses', targetAgeDays: 61, ageGroupLabel: '0 AÑOS', phase: 'infant' },
  { controlNumber: 6, label: '3 meses', targetAgeDays: 91, ageGroupLabel: '0 AÑOS', phase: 'infant' },
  { controlNumber: 7, label: '4 meses', targetAgeDays: 122, ageGroupLabel: '0 AÑOS', phase: 'infant' },
  { controlNumber: 8, label: '6 meses', targetAgeDays: 183, ageGroupLabel: '0 AÑOS', phase: 'infant' },
  { controlNumber: 9, label: '7 meses', targetAgeDays: 213, ageGroupLabel: '0 AÑOS', phase: 'infant' },
  { controlNumber: 10, label: '9 meses', targetAgeDays: 274, ageGroupLabel: '0 AÑOS', phase: 'infant' },

  // 1 año (4 controles)
  { controlNumber: 11, label: '12 meses', targetAgeDays: 365, ageGroupLabel: '1 AÑO', phase: 'toddler' },
  { controlNumber: 12, label: '15 meses', targetAgeDays: 456, ageGroupLabel: '1 AÑO', phase: 'toddler' },
  { controlNumber: 13, label: '18 meses', targetAgeDays: 548, ageGroupLabel: '1 AÑO', phase: 'toddler' },
  { controlNumber: 14, label: '21 meses', targetAgeDays: 639, ageGroupLabel: '1 AÑO', phase: 'toddler' },

  // 2 a 4 años (2 controles semestrales por año)
  { controlNumber: 15, label: '24 meses', targetAgeDays: 730, ageGroupLabel: '2 AÑOS', phase: 'toddler' },
  { controlNumber: 16, label: '30 meses', targetAgeDays: 913, ageGroupLabel: '2 AÑOS', phase: 'preschool' },
  { controlNumber: 17, label: '36 meses', targetAgeDays: 1096, ageGroupLabel: '3 AÑOS', phase: 'preschool' },
  { controlNumber: 18, label: '42 meses', targetAgeDays: 1278, ageGroupLabel: '3 AÑOS', phase: 'preschool' },
  { controlNumber: 19, label: '48 meses', targetAgeDays: 1461, ageGroupLabel: '4 AÑOS', phase: 'preschool' },
  { controlNumber: 20, label: '54 meses', targetAgeDays: 1643, ageGroupLabel: '4 AÑOS', phase: 'preschool' },

  // 5 a 11 años (1 control anual)
  { controlNumber: 21, label: '5 años', targetAgeDays: 1826, ageGroupLabel: '5 AÑOS', phase: 'school' },
  { controlNumber: 22, label: '6 años', targetAgeDays: 2191, ageGroupLabel: '6 AÑOS', phase: 'school' },
  { controlNumber: 23, label: '7 años', targetAgeDays: 2557, ageGroupLabel: '7 AÑOS', phase: 'school' },
  { controlNumber: 24, label: '8 años', targetAgeDays: 2922, ageGroupLabel: '8 AÑOS', phase: 'school' },
  { controlNumber: 25, label: '9 años', targetAgeDays: 3287, ageGroupLabel: '9 AÑOS', phase: 'school' },
  { controlNumber: 26, label: '10 años', targetAgeDays: 3652, ageGroupLabel: '10 AÑOS', phase: 'school' },
  { controlNumber: 27, label: '11 años', targetAgeDays: 4018, ageGroupLabel: '11 AÑOS', phase: 'school' },
];

/**
 * Retorna las definiciones estáticas de los controles CRED.
 */
export function getCREDControlDefinitions(): CREDControlDefinition[] {
  return CRED_CONTROL_DEFINITIONS;
}

/**
 * Genera el calendario CRED completo con fechas concretas a partir de la fecha de nacimiento.
 */
export function generateCREDSchedule(birthDate: string | Date): CREDScheduledControl[] {
  const birth = dayjs(birthDate);

  return CRED_CONTROL_DEFINITIONS.map((def) => ({
    ...def,
    targetDate: birth.add(def.targetAgeDays, 'day').toDate(),
  }));
}
