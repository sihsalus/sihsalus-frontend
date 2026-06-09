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
    identifier: '21f010ce-4876-32ec-8844-27dfedc6705a',
  },
  feedingCounselingForm: {
    display: 'CRED-007-CONSEJERÍA ALIMENTARIA',
    identifier: '1fa86795-3d84-304a-ac9e-320a39b69ca7',
  },
  nutritionFollowupForm: {
    display: 'CRED-008-SEGUIMIENTO NUTRICIONAL',
    identifier: '24e8dd94-f712-352f-96c2-0dbd8c15068d',
  },
} as const satisfies Partial<Record<CREDFormKey, CREDFormFallback>>;

export const neonatalFormFallbacks = {
  atencionImmediataNewborn: {
    display: '(Página 5) ATENCIÓN INMEDIATA DEL RECIÉN NACIDO',
    identifier: '33b6449b-3fc6-3ec1-be3f-0bd29146315f',
  },
  newbornNeuroEval: {
    display: '(Página 6) EVALUACIÓN CÉFALO-CAUDAL Y NEUROLÓGICO DEL RECIÉN NACIDO',
    identifier: '87745826-b5ac-3366-b17f-5c7335c39006',
  },
  breastfeedingObservation: {
    display: '(Página 8) Ficha de Observación del Amamantamiento de la Consejería en Lactancia Materna',
    identifier: '46624035-79b7-3025-abfc-b02249f16e77',
  },
  roomingIn: {
    display: '(Página 10) Alojamiento Conjunto',
    identifier: '4767ab9c-00c8-358f-a2cd-cd7f0d4b42d3',
  },
  birthDetails: {
    display: '(CRED) Detalles de Nacimiento',
    identifier: '8db0f1dc-c191-3468-854c-6c6c41ef6198',
  },
  pregnancyDetails: {
    display: '(CRED) Embarazo y Parto',
    identifier: '307e2887-9902-3ab2-83d9-f3e48ef7bdb2',
  },
} as const satisfies Partial<Record<CREDFormKey, CREDFormFallback>>;

const credFormFallbacks = {
  ...childNutritionFormFallbacks,
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
