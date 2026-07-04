import { launchWorkspace2, openmrsFetch, restBaseUrl, showSnackbar, useConfig } from '@openmrs/esm-framework';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

import type { ConfigObject } from '../config-schema';
import { type Form, type FormEncounterResource, formEntryWorkspace } from '../types';

type CREDFormKey = keyof ConfigObject['formsList'];

type CREDFormFallback = {
  display: string;
  identifier: string;
};

type OpenmrsFormResponse = Partial<Omit<Form, 'resources'>> & {
  uuid: string;
  resources?: Array<FormEncounterResource>;
};

type OpenmrsFormSearchResponse = {
  results?: Array<OpenmrsFormResponse>;
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

const formRepresentation =
  '(uuid,name,display,version,published,retired,resources:(uuid,name,dataType,valueReference))';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getCREDFormIdentifier(
  formsList: Partial<ConfigObject['formsList']> | undefined,
  formKey: CREDFormKey,
  fallback?: CREDFormFallback,
) {
  const configuredIdentifier = formsList?.[formKey]?.trim();
  return configuredIdentifier || fallback?.identifier;
}

export async function resolveCREDForm(identifier: string, fallbackDisplay: string): Promise<Form> {
  const normalizedIdentifier = identifier.trim();

  if (!normalizedIdentifier) {
    throw new Error('CRED form identifier is empty');
  }

  if (uuidPattern.test(normalizedIdentifier)) {
    const response = await openmrsFetch<OpenmrsFormResponse>(
      `${restBaseUrl}/form/${normalizedIdentifier}?v=custom:${formRepresentation}`,
    );
    return normalizeForm(response.data, fallbackDisplay);
  }

  const searchParams = new URLSearchParams();
  searchParams.set('q', normalizedIdentifier);
  searchParams.set('v', `custom:${formRepresentation}`);

  const response = await openmrsFetch<OpenmrsFormSearchResponse>(`${restBaseUrl}/form?${searchParams.toString()}`);
  const form = findBestFormMatch(response.data.results ?? [], normalizedIdentifier);

  if (!form?.uuid) {
    throw new Error(`No published CRED form found for "${normalizedIdentifier}"`);
  }

  return normalizeForm(form, fallbackDisplay);
}

export function useCREDFormLauncher(formKey: CREDFormKey, fallback = credFormFallbacks[formKey]) {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();
  const formIdentifier = getCREDFormIdentifier(config?.formsList, formKey, fallback);
  const fallbackDisplay = fallback?.display ?? formKey;

  const {
    data: form,
    error,
    isLoading,
  } = useSWR<Form, Error>(formIdentifier ? `cred-form:${formIdentifier}:${fallbackDisplay}` : null, () =>
    resolveCREDForm(formIdentifier ?? '', fallbackDisplay),
  );

  const launchForm = useCallback(
    (encounterUuid = '') => {
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

function normalizeKey(value?: string) {
  return value?.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function findBestFormMatch(forms: Array<OpenmrsFormResponse>, identifier: string) {
  const normalizedIdentifier = normalizeKey(identifier);
  const publishedForms = forms.filter((form) => form.published !== false && form.retired !== true);
  const candidates = publishedForms.length ? publishedForms : forms;

  return (
    candidates.find((form) =>
      [form.uuid, form.name, form.display].some((value) => normalizeKey(value) === normalizedIdentifier),
    ) ?? candidates[0]
  );
}

function normalizeForm(form: OpenmrsFormResponse, fallbackDisplay: string): Form {
  const display = form.display ?? form.name ?? fallbackDisplay;

  return {
    uuid: form.uuid,
    name: form.name ?? display,
    display,
    version: form.version ?? '1.0',
    published: form.published ?? true,
    retired: form.retired ?? false,
    resources: form.resources ?? [],
    formCategory: form.formCategory ?? 'CRED',
  };
}
