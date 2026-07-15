import { launchWorkspace2, openmrsFetch, restBaseUrl, showSnackbar, useConfig } from '@openmrs/esm-framework';
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

import type { ConfigObject } from '../config-schema';
import { type Form, type FormEncounterResource, formEntryWorkspace } from '../types';

type MaternalFormKey = keyof ConfigObject['formsList'];

type OpenmrsFormResponse = Partial<Omit<Form, 'resources'>> & {
  uuid: string;
  resources?: Array<FormEncounterResource>;
};

type OpenmrsFormSearchResponse = {
  results?: Array<OpenmrsFormResponse>;
};

const formRepresentation =
  '(uuid,name,display,version,published,retired,resources:(uuid,name,dataType,valueReference))';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolveMaternalForm(identifier: string, fallbackDisplay: string): Promise<Form> {
  const normalizedIdentifier = identifier.trim();
  if (!normalizedIdentifier) {
    throw new Error('Maternal form identifier is empty');
  }

  if (uuidPattern.test(normalizedIdentifier)) {
    const response = await openmrsFetch<OpenmrsFormResponse>(
      `${restBaseUrl}/form/${normalizedIdentifier}?v=custom:${formRepresentation}`,
    );
    const form = normalizeForm(response.data, fallbackDisplay);
    if (normalizeKey(form.uuid) !== normalizeKey(normalizedIdentifier)) {
      throw new Error('The OpenMRS form response did not match the requested UUID');
    }
    return form;
  }

  const searchParams = new URLSearchParams({
    q: normalizedIdentifier,
    v: `custom:${formRepresentation}`,
  });
  const response = await openmrsFetch<OpenmrsFormSearchResponse>(`${restBaseUrl}/form?${searchParams.toString()}`);
  if (!Array.isArray(response.data?.results)) {
    throw new Error('The OpenMRS form search returned an invalid response');
  }
  const normalizedSearch = normalizeKey(normalizedIdentifier);
  const matchingForms = response.data.results
    .filter((candidate) => candidate.published === true && candidate.retired === false)
    .filter((candidate) =>
      [candidate.uuid, candidate.name, candidate.display].some((value) => normalizeKey(value) === normalizedSearch),
    );
  if (matchingForms.length === 0) {
    throw new Error(`No exact published maternal form found for "${normalizedIdentifier}"`);
  }
  if (matchingForms.length > 1) {
    throw new Error(`Multiple exact published maternal forms found for "${normalizedIdentifier}"`);
  }
  return normalizeForm(matchingForms[0], fallbackDisplay);
}

export function useMaternalFormLauncher(formKey: MaternalFormKey, fallbackDisplay: string) {
  const config = useConfig<ConfigObject>();
  const formIdentifier = config?.formsList?.[formKey]?.trim();
  return useMaternalFormIdentifierLauncher(formIdentifier, fallbackDisplay);
}

export function useMaternalFormIdentifierLauncher(formIdentifier: string | undefined, fallbackDisplay: string) {
  const { t } = useTranslation();
  const normalizedFormIdentifier = formIdentifier?.trim() || undefined;
  const {
    data: form,
    error,
    isLoading,
  } = useSWR<Form, Error>(
    normalizedFormIdentifier ? `maternal-form:${normalizedFormIdentifier}:${fallbackDisplay}` : null,
    () => resolveMaternalForm(normalizedFormIdentifier ?? '', fallbackDisplay),
  );

  useEffect(() => {
    if (error) {
      console.error('Unable to resolve the configured maternal form', error);
    }
  }, [error]);

  const launchForm = useCallback(
    (encounterUuid = '', handlePostResponse?: () => void) => {
      if (!normalizedFormIdentifier) {
        showSnackbar({
          kind: 'warning',
          title: t('maternalFormNotConfigured', 'Formulario materno no configurado'),
          subtitle: t(
            'maternalFormNotConfiguredSubtitle',
            'No se encontró una asociación de formulario para este flujo.',
          ),
        });
        return;
      }
      if (isLoading) {
        showSnackbar({
          kind: 'info',
          title: t('maternalFormLoading', 'Validando formulario materno'),
          subtitle: t('maternalFormLoadingSubtitle', 'Espere un momento e intente nuevamente.'),
        });
        return;
      }
      if (error || !form) {
        showSnackbar({
          kind: 'error',
          title: t('maternalFormNotAvailable', 'Formulario materno no disponible'),
          subtitle: t(
            'maternalFormNotAvailableSubtitle',
            'Revise que el formulario esté publicado y que el UUID o nombre configurado sea exacto.',
          ),
        });
        return;
      }

      launchWorkspace2(formEntryWorkspace, { form, encounterUuid, handlePostResponse });
    },
    [error, form, isLoading, normalizedFormIdentifier, t],
  );

  return {
    error,
    form,
    formIdentifier: normalizedFormIdentifier,
    isLoading: Boolean(normalizedFormIdentifier && isLoading),
    launchForm,
  };
}

function normalizeKey(value?: string) {
  return value?.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeForm(form: OpenmrsFormResponse, fallbackDisplay: string): Form {
  if (!form?.uuid || form.published !== true || form.retired !== false) {
    throw new Error('The configured maternal form is unavailable, unpublished or retired');
  }
  const display = form.display ?? form.name ?? fallbackDisplay;
  return {
    uuid: form.uuid,
    name: form.name ?? display,
    display,
    version: form.version ?? '1.0',
    published: true,
    retired: false,
    resources: form.resources ?? [],
    formCategory: form.formCategory ?? 'Maternal',
  };
}
