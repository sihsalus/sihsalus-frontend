// hooks/useCREDFormsForAgeGroup.ts

import { useMemo } from "react";

import { type ConfigObject, configSchema } from "../config-schema";
import {
  credCourseLifeEditPrivilege,
  credEarlyStimulationEditPrivilege,
  credNeonatalEditPrivilege,
  credNutritionEditPrivilege,
} from "../constants";
import type { CompletedFormInfo } from "../types";
import {
  calculateAgeInDays,
  calculateAgeInMonths,
  getAgeGroup,
} from "../utils/age-group-utils";

type CredFormKey = keyof ConfigObject["formsList"];
type CompletedCREDFormInfo = CompletedFormInfo & {
  formKey?: CredFormKey;
  requiredPrivilege?: string;
};

const credFormLabels: Partial<Record<CredFormKey, string>> = {
  atencionImmediataNewborn: "Atención inmediata del recién nacido",
  newbornNeuroEval: "Evaluación céfalo-caudal y neurológica",
  breastfeedingObservation: "Observación del amamantamiento",
  roomingIn: "Alojamiento conjunto",
  nursingAssessment: "Valoración de enfermería",
  riskInterview0to30: "Factores de riesgo y protección",
  childFeeding0to5: "Evaluación de alimentación (0 a 5 meses)",
  childFeeding6to42: "Evaluación de alimentación (6 a 42 meses)",
  childAbuseScreening: "Tamizaje de violencia y maltrato infantil",
  anemiaScreeningForm: "Tamizaje de anemia",
  supplementationForm: "Suplementación preventiva",
  nutritionalAssessmentForm: "Evaluación nutricional",
  feedingCounselingForm: "Consejería alimentaria",
  nutritionFollowupForm: "Seguimiento nutricional",
  stimulationSessionForm: "Sesión de atención temprana del desarrollo",
  stimulationFollowupForm: "Seguimiento del desarrollo",
  stimulationCounselingForm: "Consejería de desarrollo infantil",
  ediDevelopmentForm: "Evaluación del Desarrollo Infantil (EDI)",
  autismScreeningForm: "Tamizaje TEA (M-CHAT-R/F)",
  childMentalHealthForm: "Salud mental del niño y cuidador",
  parasitosisScreeningForm: "Descarte de parasitosis",
  vitaminAAdministrationForm: "Administración de vitamina A",
  physicalExamForm: "Examen físico integral",
  growthNutritionEvaluationForm: "Crecimiento y estado nutricional",
  oralHealthInspectionForm: "Inspección de cavidad bucal",
  visualScreeningForm: "Tamizaje visual",
  hearingScreeningForm: "Evaluación auditiva",
  cancerWarningSignsForm: "Signos de sospecha de cáncer",
  metalsExposureScreeningForm: "Exposición a metales pesados",
  violenceDisciplineScreeningForm: "Violencia, disciplina y castigo físico",
  credCounselingAgreementForm: "Consejería, acuerdos y compromisos",
  homeVisitFollowupForm: "Visita domiciliaria y seguimiento",
  referralInterconsultationForm: "Interconsulta, derivación o referencia",
  schoolHealthCounselingForm: "Consejería escolar y lonchera saludable",
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
  const credFormsByAgeGroup = configuredAgeGroups?.some(
    (group) => Array.isArray(group.forms) && group.forms.length > 0,
  )
    ? configuredAgeGroups
    : configSchema.CREDFormsByAgeGroup._default;
  const formsList = config?.formsList ?? {};
  const defaultFormsList = configSchema.formsList._default;

  if (!birthDate || !credFormsByAgeGroup || !formsList) return [];

  const days = calculateAgeInDays(birthDate, referenceDate);
  const months = Math.max(1, calculateAgeInMonths(birthDate, referenceDate));
  const matchedGroup =
    days <= 28
      ? credFormsByAgeGroup.find(
          (group) =>
            group.minDays !== undefined &&
            group.maxDays !== undefined &&
            days >= group.minDays &&
            days <= group.maxDays,
        )
      : getAgeGroup(
          months,
          credFormsByAgeGroup.filter(
            (group) =>
              group.minMonths !== undefined && group.maxMonths !== undefined,
          ),
        );

  if (!matchedGroup || !matchedGroup.forms) return [];

  const uniqueFormKeys = Array.from(new Set(matchedGroup.forms));

  return uniqueFormKeys
    .map((formKey) => {
      const typedFormKey = formKey as CredFormKey;
      const formUuid =
        formsList?.[typedFormKey] || defaultFormsList?.[typedFormKey];
      if (!formUuid) return null;

      const display = credFormLabels[typedFormKey] ?? String(formUuid);
      return {
        form: {
          uuid: String(formUuid),
          name: display,
          display,
          version: "1",
          published: true,
          retired: false,
          resources: [],
          formCategory: "CRED",
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
