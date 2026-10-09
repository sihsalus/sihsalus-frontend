import type { ConfigObject } from '../config-schema';
import type { PatientPrenatalAntecedents } from '../types';

interface ObstetricField {
  key: Exclude<keyof PatientPrenatalAntecedents, 'id' | 'date'>;
  conceptKey: keyof ConfigObject['madreGestante'];
  labelKey: string;
}

// OBST-001 owns the meanings and values. Term/preterm births are different
// dimensions from vaginal/caesarean births and must never be substituted.
export const obstetricHistoryFields = [
  { key: 'gravidez', conceptKey: 'gravidezUuid', labelKey: 'obstetricGestas' },
  { key: 'partoAborto', conceptKey: 'partoAbortoUuid', labelKey: 'abortions' },
  { key: 'partos', conceptKey: 'partosUuid', labelKey: 'births' },
  { key: 'partosVaginales', conceptKey: 'partosVaginalesUuid', labelKey: 'obstetricVaginalBirths' },
  { key: 'cesareas', conceptKey: 'cesareasUuid', labelKey: 'obstetricCaesareans' },
  { key: 'partoNacidoVivo', conceptKey: 'partoNacidoVivoUuid', labelKey: 'liveBirths' },
  { key: 'partoNacidoMuerto', conceptKey: 'partoNacidoMuertoUuid', labelKey: 'stillBirths' },
  { key: 'nacidosVivosViven', conceptKey: 'nacidosVivosVivenUuid', labelKey: 'obstetricLivingChildren' },
  { key: 'muertePrimeraSemana', conceptKey: 'muertePrimeraSemanaUuid', labelKey: 'obstetricFirstWeekDeaths' },
  { key: 'muerteDespuesPrimeraSemana', conceptKey: 'muerteDespuesPrimeraSemanaUuid', labelKey: 'obstetricLaterDeaths' },
  { key: 'mayorPesoRn', conceptKey: 'mayorPesoRnUuid', labelKey: 'obstetricHighestBirthWeight' },
] as const satisfies readonly ObstetricField[];
