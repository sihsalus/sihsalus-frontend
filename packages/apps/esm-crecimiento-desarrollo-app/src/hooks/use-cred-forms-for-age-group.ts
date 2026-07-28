// hooks/useCREDFormsForAgeGroup.ts

import { useMemo } from 'react';

import { type ConfigObject, configSchema } from '../config-schema';
import {
  credCourseLifeEditPrivilege,
  credEarlyStimulationEditPrivilege,
  credNeonatalEditPrivilege,
  credNutritionEditPrivilege,
} from '../constants';
import type { CompletedFormInfo } from '../types';
import { getConfiguredAgeGroupFromBirthDate } from '../utils/age-group-utils';

type CredFormKey = keyof ConfigObject['formsList'];
type CompletedCREDFormInfo = CompletedFormInfo & {
  formKey?: CredFormKey;
  requiredPrivilege?: string;
};

const credFormLabels: Partial<Record<CredFormKey, string>> = {
  atencionImmediataNewborn: 'Atención inmediata del recién nacido',
  newbornNeuroEval: 'Evaluación céfalo-caudal y neurológica',
  breastfeedingObservation: 'Observación del amamantamiento',
  roomingIn: 'Alojamiento conjunto',
  nursingAssessment: 'Valoración de enfermería',
  riskInterview0to30: 'Factores de riesgo y protección',
  childFeeding0to5: 'Evaluación de alimentación (0 a 5 meses)',
  childFeeding6to42: 'Evaluación de alimentación (6 a 42 meses)',
  childAbuseScreening: 'Tamizaje de violencia y maltrato infantil',
  anemiaScreeningForm: 'Tamizaje de anemia (validar edad y altitud)',
  supplementationForm: 'Suplementación preventiva',
  nutritionalAssessmentForm: 'Evaluación nutricional',
  feedingCounselingForm: 'Consejería alimentaria',
  nutritionFollowupForm: 'Seguimiento nutricional',
  stimulationSessionForm: 'Sesión de atención temprana del desarrollo',
  stimulationFollowupForm: 'Seguimiento del desarrollo',
  stimulationCounselingForm: 'Consejería de desarrollo infantil',
  ediDevelopmentForm: 'EDI (registro resumido; aplicar instrumento oficial)',
  autismScreeningForm: 'M-CHAT-R/F (registro resumido; aplicar cuestionario oficial)',
  childMentalHealthForm: 'Salud mental del niño y cuidador (registro resumido)',
  parasitosisScreeningForm: 'Descarte de parasitosis',
  vitaminAAdministrationForm: 'Vitamina A (solo en zonas de riesgo)',
  physicalExamForm: 'Examen físico integral',
  growthNutritionEvaluationForm: 'Crecimiento y estado nutricional (registro resumido)',
  oralHealthInspectionForm: 'Inspección de cavidad bucal',
  visualScreeningForm: 'Tamizaje visual',
  hearingScreeningForm: 'Evaluación auditiva',
  cancerWarningSignsForm: 'Signos de sospecha de cáncer',
  metalsExposureScreeningForm: 'Exposición a metales pesados (según riesgo)',
  violenceDisciplineScreeningForm: 'Violencia, disciplina y castigo físico',
  credCounselingAgreementForm: 'Consejería, acuerdos y compromisos',
  homeVisitFollowupForm: 'Visita domiciliaria y seguimiento (según indicación)',
  referralInterconsultationForm: 'Interconsulta, derivación o referencia (según indicación)',
  schoolHealthCounselingForm: 'Consejería escolar y lonchera saludable',
  huancaNeurodevelopmentForm: 'Vigilancia Huanca (registro resumido)',
  expectedSkillsBehaviorsForm: 'Habilidades y conductas esperadas (registro resumido)',
};

const credFormEditPrivileges: Partial<Record<CredFormKey, string>> = {
  atencionImmediataNewborn: credNeonatalEditPrivilege,
  breastfeedingObservation: credNeonatalEditPrivilege,
  newbornNeuroEval: credNeonatalEditPrivilege,
  roomingIn: credNeonatalEditPrivilege,
  birthDetails: credNeonatalEditPrivilege,
  pregnancyDetails: credNeonatalEditPrivilege,
  childFeeding0to5: credNutritionEditPrivilege,
  childFeeding6to42: credNutritionEditPrivilege,
  anemiaScreeningForm: credNutritionEditPrivilege,
  supplementationForm: credNutritionEditPrivilege,
  nutritionalAssessmentForm: credNutritionEditPrivilege,
  feedingCounselingForm: credNutritionEditPrivilege,
  nutritionFollowupForm: credNutritionEditPrivilege,
  parasitosisScreeningForm: credNutritionEditPrivilege,
  vitaminAAdministrationForm: credNutritionEditPrivilege,
  growthNutritionEvaluationForm: credNutritionEditPrivilege,
  stimulationSessionForm: credEarlyStimulationEditPrivilege,
  stimulationFollowupForm: credEarlyStimulationEditPrivilege,
  stimulationCounselingForm: credEarlyStimulationEditPrivilege,
  ediDevelopmentForm: credEarlyStimulationEditPrivilege,
  autismScreeningForm: credEarlyStimulationEditPrivilege,
  childMentalHealthForm: credEarlyStimulationEditPrivilege,
  huancaNeurodevelopmentForm: credEarlyStimulationEditPrivilege,
  expectedSkillsBehaviorsForm: credEarlyStimulationEditPrivilege,
  tepsi: credEarlyStimulationEditPrivilege,
};

export function useCREDFormsForAgeGroup(
  config: ConfigObject,
  birthDate: string | undefined,
  referenceDate?: Date | string,
): CompletedCREDFormInfo[] {
  return useMemo(() => {
    return getCREDFormsForAgeGroup(config, birthDate, referenceDate);
  }, [birthDate, config, referenceDate]);
}

export function getCREDFormsForAgeGroup(
  config: ConfigObject,
  birthDate: string | undefined,
  referenceDate?: Date | string,
): CompletedCREDFormInfo[] {
  const configuredAgeGroups = config?.CREDFormsByAgeGroup;
  const credFormsByAgeGroup = configuredAgeGroups?.some((group) => Array.isArray(group.forms) && group.forms.length > 0)
    ? configuredAgeGroups
    : configSchema.CREDFormsByAgeGroup._default;
  const formsList = config?.formsList ?? {};
  const defaultFormsList = configSchema.formsList._default;

  if (!birthDate || !credFormsByAgeGroup || !formsList) return [];

  const matchedGroup = getConfiguredAgeGroupFromBirthDate(birthDate, credFormsByAgeGroup, referenceDate);

  if (!matchedGroup || !matchedGroup.forms) return [];

  const uniqueFormKeys = Array.from(new Set(matchedGroup.forms));

  return uniqueFormKeys
    .map((formKey) => {
      const typedFormKey = formKey as CredFormKey;
      const formUuid = formsList?.[typedFormKey] || defaultFormsList?.[typedFormKey];
      if (!formUuid) return null;

      const display = credFormLabels[typedFormKey] ?? String(formUuid);
      return {
        form: {
          uuid: String(formUuid),
          name: display,
          display,
          version: '1',
          published: true,
          retired: false,
          resources: [],
          formCategory: 'CRED',
        },
        formKey: typedFormKey,
        requiredPrivilege: getCREDFormEditPrivilege(typedFormKey),
        associatedEncounters: [],
        lastCompletedDate: undefined,
      };
    })
    .filter(Boolean) as CompletedCREDFormInfo[];
}

export function getCREDFormEditPrivilege(formKey: CredFormKey): string {
  return credFormEditPrivileges[formKey] ?? credCourseLifeEditPrivilege;
}
