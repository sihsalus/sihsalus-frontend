import { launchWorkspace2, showSnackbar, useConfig } from '@openmrs/esm-framework';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

import type { ConfigObject } from '../config-schema';
import { resolvePublishedForm } from '@openmrs/esm-patient-common-lib';
import { type Form, formEntryWorkspace } from '../types';

type CREDFormKey = keyof ConfigObject['formsList'];

type CREDFormFallback = {
  display: string;
  identifier: string;
};

export const childNutritionFormFallbacks = {
  nutritionalAssessmentForm: {
    display: 'CRED-006-EVALUACIÓN NUTRICIONAL',
    identifier: 'CRED-006-EVALUACIÓN NUTRICIONAL',
  },
  feedingCounselingForm: {
    display: 'CRED-007-CONSEJERÍA ALIMENTARIA',
    identifier: 'CRED-007-CONSEJERÍA ALIMENTARIA',
  },
  nutritionFollowupForm: {
    display: 'CRED-008-SEGUIMIENTO NUTRICIONAL',
    identifier: 'CRED-008-SEGUIMIENTO NUTRICIONAL',
  },
} as const satisfies Partial<Record<CREDFormKey, CREDFormFallback>>;

export const wellChildControlFormFallbacks = {
  nursingAssessment: {
    display: '(Página 11 y 12) Valoración de Enfermería',
    identifier: '(Página 11 y 12) Valoración de Enfermería',
  },
  riskInterview0to30: {
    display: '(Página 19) PRIMERA ENTREVISTA EN BUSCA DE FACTORES DE RIESGO (0 - 30 meses)',
    identifier: '(Página 19) PRIMERA ENTREVISTA EN BUSCA DE FACTORES DE RIESGO (0 - 30 meses)',
  },
  childFeeding0to5: {
    display: '(Página 20) Evaluación de la alimentación del niño/niña (0 - 5 meses)',
    identifier: '(Página 20) Evaluación de la alimentación del niño/niña (0 - 5 meses)',
  },
  childFeeding6to42: {
    display: '(Página 20) Evaluación de la alimentación del niño/niña (6 - 42 meses)',
    identifier: '(Página 20) Evaluación de la alimentación del niño/niña (6 - 42 meses)',
  },
  childAbuseScreening: {
    display: '(Página 37) Ficha de Tamizaje Violencia y maltrato infantil',
    identifier: '(Página 37) Ficha de Tamizaje Violencia y maltrato infantil',
  },
  anemiaScreeningForm: {
    display: 'CRED-001-TAMIZAJE DE ANEMIA',
    identifier: 'CRED-001-TAMIZAJE DE ANEMIA',
  },
  supplementationForm: {
    display: 'CRED-002-SUPLEMENTACIÓN NIÑO',
    identifier: 'CRED-002-SUPLEMENTACIÓN NIÑO',
  },
  stimulationSessionForm: {
    display: 'CRED-003-SESIÓN DE ESTIMULACIÓN TEMPRANA',
    identifier: 'CRED-003-SESIÓN DE ESTIMULACIÓN TEMPRANA',
  },
  stimulationFollowupForm: {
    display: 'CRED-004-SEGUIMIENTO DEL DESARROLLO',
    identifier: 'CRED-004-SEGUIMIENTO DEL DESARROLLO',
  },
  stimulationCounselingForm: {
    display: 'CRED-005-CONSEJERÍA A PADRES',
    identifier: 'CRED-005-CONSEJERÍA A PADRES',
  },
  ediDevelopmentForm: {
    display: 'CRED-009-EDI',
    identifier: 'CRED-009-EDI',
  },
  autismScreeningForm: {
    display: 'CRED-010-TAMIZAJE TEA',
    identifier: 'CRED-010-TAMIZAJE TEA',
  },
  childMentalHealthForm: {
    display: 'CRED-011-SALUD MENTAL NIÑO Y CUIDADOR',
    identifier: 'CRED-011-SALUD MENTAL NIÑO Y CUIDADOR',
  },
  parasitosisScreeningForm: {
    display: 'CRED-012-DESCARTE DE PARASITOSIS',
    identifier: 'CRED-012-DESCARTE DE PARASITOSIS',
  },
  vitaminAAdministrationForm: {
    display: 'CRED-013-ADMINISTRACIÓN DE VITAMINA A',
    identifier: 'CRED-013-ADMINISTRACIÓN DE VITAMINA A',
  },
  physicalExamForm: {
    display: 'CRED-014-EXAMEN FÍSICO INTEGRAL',
    identifier: 'CRED-014-EXAMEN FÍSICO INTEGRAL',
  },
  growthNutritionEvaluationForm: {
    display: 'CRED-015-CRECIMIENTO Y ESTADO NUTRICIONAL',
    identifier: 'CRED-015-CRECIMIENTO Y ESTADO NUTRICIONAL',
  },
  oralHealthInspectionForm: {
    display: 'CRED-016-INSPECCIÓN DE CAVIDAD BUCAL',
    identifier: 'CRED-016-INSPECCIÓN DE CAVIDAD BUCAL',
  },
  visualScreeningForm: {
    display: 'CRED-017-TAMIZAJE VISUAL',
    identifier: 'CRED-017-TAMIZAJE VISUAL',
  },
  hearingScreeningForm: {
    display: 'CRED-018-EVALUACIÓN AUDITIVA',
    identifier: 'CRED-018-EVALUACIÓN AUDITIVA',
  },
  cancerWarningSignsForm: {
    display: 'CRED-019-SIGNOS DE SOSPECHA DE CÁNCER',
    identifier: 'CRED-019-SIGNOS DE SOSPECHA DE CÁNCER',
  },
  metalsExposureScreeningForm: {
    display: 'CRED-020-EXPOSICIÓN A METALES PESADOS',
    identifier: 'CRED-020-EXPOSICIÓN A METALES PESADOS',
  },
  violenceDisciplineScreeningForm: {
    display: 'CRED-021-VIOLENCIA DISCIPLINA Y CASTIGO FÍSICO',
    identifier: 'CRED-021-VIOLENCIA DISCIPLINA Y CASTIGO FÍSICO',
  },
  credCounselingAgreementForm: {
    display: 'CRED-022-CONSEJERÍA ACUERDOS Y COMPROMISOS',
    identifier: 'CRED-022-CONSEJERÍA ACUERDOS Y COMPROMISOS',
  },
  homeVisitFollowupForm: {
    display: 'CRED-023-VISITA DOMICILIARIA Y SEGUIMIENTO',
    identifier: 'CRED-023-VISITA DOMICILIARIA Y SEGUIMIENTO',
  },
  referralInterconsultationForm: {
    display: 'CRED-024-INTERCONSULTA DERIVACIÓN REFERENCIA',
    identifier: 'CRED-024-INTERCONSULTA DERIVACIÓN REFERENCIA',
  },
  schoolHealthCounselingForm: {
    display: 'CRED-025-CONSEJERÍA ESCOLAR Y LONCHERA SALUDABLE',
    identifier: 'CRED-025-CONSEJERÍA ESCOLAR Y LONCHERA SALUDABLE',
  },
  huancaNeurodevelopmentForm: {
    display: 'CRED-026-HUANCA TEST VIGILANCIA NEURODESARROLLO',
    identifier: 'CRED-026-HUANCA TEST VIGILANCIA NEURODESARROLLO',
  },
  expectedSkillsBehaviorsForm: {
    display: 'CRED-027-LISTA HABILIDADES Y CONDUCTAS ESPERADAS',
    identifier: 'CRED-027-LISTA HABILIDADES Y CONDUCTAS ESPERADAS',
  },
  tepsi: {
    display: '(Página 34, 35 y 36) TEPSI',
    identifier: '(Página 34, 35 y 36) TEPSI',
  },
  adverseReactionForm: {
    display: 'INMU-002-REPORTE ESAVI',
    identifier: 'INMU-002-REPORTE ESAVI',
  },
} as const satisfies Partial<Record<CREDFormKey, CREDFormFallback>>;

export const neonatalFormFallbacks = {
  atencionImmediataNewborn: {
    display: '(Página 5) ATENCIÓN INMEDIATA DEL RECIÉN NACIDO',
    identifier: '(Página 5) ATENCIÓN INMEDIATA DEL RECIÉN NACIDO',
  },
  newbornNeuroEval: {
    display: '(Página 6) EVALUACIÓN CÉFALO-CAUDAL Y NEUROLÓGICO DEL RECIÉN NACIDO',
    identifier: '(Página 6) EVALUACIÓN CÉFALO-CAUDAL Y NEUROLÓGICO DEL RECIÉN NACIDO',
  },
  breastfeedingObservation: {
    display: '(Página 8) Ficha de Observación del Amamantamiento de la Consejería en Lactancia Materna',
    identifier: '(Página 8) Ficha de Observación del Amamantamiento de la Consejería en Lactancia Materna',
  },
  roomingIn: {
    display: '(Página 10) Alojamiento Conjunto',
    identifier: '(Página 10) Alojamiento Conjunto',
  },
  birthDetails: {
    display: '(CRED) Detalles de Nacimiento',
    identifier: '(CRED) Detalles de Nacimiento',
  },
  pregnancyDetails: {
    display: '(CRED) Embarazo y Parto',
    identifier: '(CRED) Embarazo y Parto',
  },
} as const satisfies Partial<Record<CREDFormKey, CREDFormFallback>>;

const credFormFallbacks = {
  ...childNutritionFormFallbacks,
  ...wellChildControlFormFallbacks,
  ...neonatalFormFallbacks,
} as const satisfies Partial<Record<CREDFormKey, CREDFormFallback>>;

export function getCREDFormIdentifier(
  formsList: Partial<ConfigObject['formsList']> | undefined,
  formKey: CREDFormKey,
  fallback?: CREDFormFallback,
) {
  const configuredIdentifier = formsList?.[formKey]?.trim();
  return configuredIdentifier || fallback?.identifier;
}

export function resolveCREDForm(identifier: string, fallbackDisplay: string): Promise<Form> {
  return resolvePublishedForm(identifier, {
    fallbackDisplay,
    formCategory: 'CRED',
  });
}

export function useCREDFormLauncher(
  formKey: CREDFormKey,
  fallback = credFormFallbacks[formKey],
  existingFormUuid?: string,
) {
  const { t } = useTranslation('@sihsalus/esm-cred-app');
  const config = useConfig<ConfigObject>();
  // Editing must use the encounter's schema, even if the configured form has
  // since been replaced. The form engine verifies this identity before saving.
  const formIdentifier = existingFormUuid || getCREDFormIdentifier(config?.formsList, formKey, fallback);
  const fallbackDisplay = fallback?.display ?? formKey;

  const {
    data: form,
    error,
    isLoading,
  } = useSWR<Form, Error>(formIdentifier ? `cred-form:${formIdentifier}:${fallbackDisplay}` : null, () =>
    resolveCREDForm(formIdentifier ?? '', fallbackDisplay),
  );

  const launchForm = useCallback(
    (encounterUuid = '', handlePostResponse?: () => unknown) => {
      if (!formIdentifier) {
        showSnackbar({
          kind: 'warning',
          title: t('credFormNotConfigured', 'Formulario CRED no configurado'),
          subtitle: t('credFormNotConfiguredSubtitle', 'No se encontró una asociación de formulario para este widget.'),
        });
        return;
      }

      if (error || !form) {
        showSnackbar({
          kind: 'error',
          title: t('credFormNotAvailable', 'Formulario CRED no disponible'),
          subtitle: t(
            'credFormNotAvailableSubtitle',
            'Revise que el formulario esté publicado en OpenMRS y que el UUID o nombre configurado sea correcto.',
          ),
        });
        return;
      }

      launchWorkspace2(formEntryWorkspace, {
        form,
        encounterUuid,
        handlePostResponse: async () => {
          try {
            await handlePostResponse?.();
          } catch {
            showSnackbar({
              kind: 'warning',
              title: t('credSummaryRefreshFailed', 'No se pudo actualizar el resumen CRED'),
              subtitle: t(
                'credSummaryRefreshFailedSubtitle',
                'La atención se guardó. Recargue la historia para ver los cambios; no vuelva a registrarla.',
              ),
            });
          }
        },
      });
    },
    [error, form, formIdentifier, t],
  );

  return {
    error,
    form,
    formIdentifier,
    isLoading: Boolean(formIdentifier && isLoading),
    launchForm,
  };
}
