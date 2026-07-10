import dayjs from 'dayjs';

export type CREDPhase = 'neonatal' | 'infant' | 'toddler' | 'preschool' | 'school';

export interface CREDControlDefinition {
  controlNumber: number;
  label: string;
  targetAgeDays?: number;
  targetAgeMonths?: number;
  dueEndAgeDays?: number;
  ageGroupLabel: string;
  phase: CREDPhase;
}

export interface CREDScheduledControl extends CREDControlDefinition {
  targetDate: Date;
  dueEndDate: Date;
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
  {
    controlNumber: 1,
    label: 'RN - 3 a 6 días',
    targetAgeDays: 3,
    dueEndAgeDays: 6,
    ageGroupLabel: 'RN - 3 a 6d',
    phase: 'neonatal',
  },
  {
    controlNumber: 2,
    label: 'RN - 7 a 13 días',
    targetAgeDays: 7,
    dueEndAgeDays: 13,
    ageGroupLabel: 'RN - 7 a 13d',
    phase: 'neonatal',
  },
  {
    controlNumber: 3,
    label: 'RN - 14 a 21 días',
    targetAgeDays: 14,
    dueEndAgeDays: 21,
    ageGroupLabel: 'RN - 14 a 21d',
    phase: 'neonatal',
  },

  // 29 días a 11 meses y 29 días (7 controles)
  { controlNumber: 4, label: '1 mes', targetAgeMonths: 1, ageGroupLabel: '0 AÑOS', phase: 'infant' },
  { controlNumber: 5, label: '2 meses', targetAgeMonths: 2, ageGroupLabel: '0 AÑOS', phase: 'infant' },
  { controlNumber: 6, label: '3 meses', targetAgeMonths: 3, ageGroupLabel: '0 AÑOS', phase: 'infant' },
  { controlNumber: 7, label: '4 meses', targetAgeMonths: 4, ageGroupLabel: '0 AÑOS', phase: 'infant' },
  { controlNumber: 8, label: '6 meses', targetAgeMonths: 6, ageGroupLabel: '0 AÑOS', phase: 'infant' },
  { controlNumber: 9, label: '7 meses', targetAgeMonths: 7, ageGroupLabel: '0 AÑOS', phase: 'infant' },
  { controlNumber: 10, label: '9 meses', targetAgeMonths: 9, ageGroupLabel: '0 AÑOS', phase: 'infant' },

  // 1 año (4 controles)
  { controlNumber: 11, label: '12 meses', targetAgeMonths: 12, ageGroupLabel: '1 AÑO', phase: 'toddler' },
  { controlNumber: 12, label: '15 meses', targetAgeMonths: 15, ageGroupLabel: '1 AÑO', phase: 'toddler' },
  { controlNumber: 13, label: '18 meses', targetAgeMonths: 18, ageGroupLabel: '1 AÑO', phase: 'toddler' },
  { controlNumber: 14, label: '21 meses', targetAgeMonths: 21, ageGroupLabel: '1 AÑO', phase: 'toddler' },

  // 2 a 4 años (2 controles semestrales por año)
  { controlNumber: 15, label: '24 meses', targetAgeMonths: 24, ageGroupLabel: '2 AÑOS', phase: 'toddler' },
  { controlNumber: 16, label: '30 meses', targetAgeMonths: 30, ageGroupLabel: '2 AÑOS', phase: 'preschool' },
  { controlNumber: 17, label: '36 meses', targetAgeMonths: 36, ageGroupLabel: '3 AÑOS', phase: 'preschool' },
  { controlNumber: 18, label: '42 meses', targetAgeMonths: 42, ageGroupLabel: '3 AÑOS', phase: 'preschool' },
  { controlNumber: 19, label: '48 meses', targetAgeMonths: 48, ageGroupLabel: '4 AÑOS', phase: 'preschool' },
  { controlNumber: 20, label: '54 meses', targetAgeMonths: 54, ageGroupLabel: '4 AÑOS', phase: 'preschool' },

  // 5 a 11 años (1 control anual)
  { controlNumber: 21, label: '5 años', targetAgeMonths: 60, ageGroupLabel: '5 AÑOS', phase: 'school' },
  { controlNumber: 22, label: '6 años', targetAgeMonths: 72, ageGroupLabel: '6 AÑOS', phase: 'school' },
  { controlNumber: 23, label: '7 años', targetAgeMonths: 84, ageGroupLabel: '7 AÑOS', phase: 'school' },
  { controlNumber: 24, label: '8 años', targetAgeMonths: 96, ageGroupLabel: '8 AÑOS', phase: 'school' },
  { controlNumber: 25, label: '9 años', targetAgeMonths: 108, ageGroupLabel: '9 AÑOS', phase: 'school' },
  { controlNumber: 26, label: '10 años', targetAgeMonths: 120, ageGroupLabel: '10 AÑOS', phase: 'school' },
  { controlNumber: 27, label: '11 años', targetAgeMonths: 132, ageGroupLabel: '11 AÑOS', phase: 'school' },
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

  return CRED_CONTROL_DEFINITIONS.map((def, index) => {
    const targetDate = getDateAtAge(birth, def);
    const nextDefinition = CRED_CONTROL_DEFINITIONS[index + 1];
    const dueEndDate = def.dueEndAgeDays
      ? birth.add(def.dueEndAgeDays, 'day')
      : nextDefinition
        ? getDateAtAge(birth, nextDefinition).subtract(1, 'day')
        : birth.add(144, 'month').subtract(1, 'day');

    return {
      ...def,
      targetDate: targetDate.toDate(),
      dueEndDate: dueEndDate.toDate(),
    };
  });
}

function getDateAtAge(birth: dayjs.Dayjs, definition: CREDControlDefinition): dayjs.Dayjs {
  if (definition.targetAgeMonths !== undefined) {
    return birth.add(definition.targetAgeMonths, 'month');
  }

  return birth.add(definition.targetAgeDays ?? 0, 'day');
}
