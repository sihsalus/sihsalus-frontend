import { launchWorkspace2, openmrsFetch, restBaseUrl, showSnackbar } from '@openmrs/esm-framework';
import { usePatientChartStore } from '@openmrs/esm-patient-common-lib';
import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { patientFormEntryWorkspace } from '../utils/constants';
import { useAmbulatoryVisitGuard } from './useAmbulatoryVisitGuard';

export type ConsultaExternaFormEntryMode = 'one-per-visit' | 'repeatable';

interface ConsultaExternaFormLauncherOptions {
  patientUuid: string;
  formIdentifier?: string | null;
  encounterTypeUuid?: string | null;
  ambulatoryVisitTypeUuid?: string | null;
  mutate?: () => unknown;
  entryMode: ConsultaExternaFormEntryMode;
}

interface OpenmrsFormReference {
  uuid: string;
  name?: string;
  display?: string;
  published?: boolean;
  retired?: boolean;
  encounterType?: { uuid?: string } | null;
}

interface EncounterReference {
  uuid: string;
  form?: { uuid?: string } | null;
  patient?: { uuid?: string } | null;
  visit?: { uuid?: string } | null;
  encounterType?: { uuid?: string } | null;
}

interface RestListResponse<T> {
  results?: Array<T>;
  links?: Array<{ rel?: string }>;
  totalCount?: number;
}

type LaunchFailureCode = 'form-unavailable' | 'multiple-encounters' | 'verification-failed';

export class ConsultaExternaLaunchError extends Error {
  constructor(readonly code: LaunchFailureCode) {
    super(code);
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const formRepresentation = 'custom:(uuid,name,display,published,retired,encounterType:(uuid))';
const encounterRepresentation = 'custom:(uuid,patient:(uuid),visit:(uuid),encounterType:(uuid),form:(uuid))';
const pageSize = 100;
const maxPages = 100;

function createRestUrl(resource: string, params: Record<string, string>): string {
  return `${restBaseUrl}/${resource}?${new URLSearchParams(params).toString()}`;
}

function sameUuid(actual?: string, expected?: string): boolean {
  return Boolean(actual && expected && actual.toLowerCase() === expected.toLowerCase());
}

function hasUsableFormState(form: OpenmrsFormReference): boolean {
  return Boolean(form.uuid && form.retired === false && form.published === true);
}

async function resolvePublishedForm(
  formIdentifier: string,
  expectedEncounterTypeUuid: string,
): Promise<OpenmrsFormReference> {
  if (UUID_PATTERN.test(formIdentifier)) {
    const response = await openmrsFetch<OpenmrsFormReference>(
      createRestUrl(`form/${formIdentifier}`, { v: formRepresentation }),
    );
    const form = response.data;
    if (
      !form ||
      !sameUuid(form.uuid, formIdentifier) ||
      !hasUsableFormState(form) ||
      !sameUuid(form.encounterType?.uuid, expectedEncounterTypeUuid)
    ) {
      throw new ConsultaExternaLaunchError('form-unavailable');
    }
    return form;
  }

  const response = await openmrsFetch<RestListResponse<OpenmrsFormReference>>(
    createRestUrl('form', { q: formIdentifier, v: formRepresentation, limit: '100' }),
  );
  if (!Array.isArray(response.data?.results) || response.data.links?.some((link) => link.rel === 'next')) {
    throw new ConsultaExternaLaunchError('verification-failed');
  }
  const matches = response.data.results.filter(
    (form) =>
      form.name === formIdentifier &&
      hasUsableFormState(form) &&
      sameUuid(form.encounterType?.uuid, expectedEncounterTypeUuid),
  );
  if (matches.length !== 1) {
    throw new ConsultaExternaLaunchError('form-unavailable');
  }
  return matches[0];
}

/**
 * Uses only OpenMRS-supported encounter filters, then verifies every returned
 * clinical identity and filters the requested form client-side across all pages.
 */
export async function findSingleEncounterForVisit(
  patientUuid: string,
  visitUuid: string,
  encounterTypeUuid: string,
  formUuid: string,
): Promise<string | undefined> {
  const matchingEncounterUuids: Array<string> = [];
  const seenEncounterUuids = new Set<string>();
  let startIndex = 0;
  let expectedTotalCount: number | undefined;

  for (let page = 0; page < maxPages; page += 1) {
    const response = await openmrsFetch<RestListResponse<EncounterReference>>(
      createRestUrl('encounter', {
        patient: patientUuid,
        visit: visitUuid,
        encounterType: encounterTypeUuid,
        v: encounterRepresentation,
        limit: String(pageSize),
        startIndex: String(startIndex),
        totalCount: 'true',
      }),
    );
    const data = response.data;
    if (!Array.isArray(data?.results) || (data.links != null && !Array.isArray(data.links))) {
      throw new ConsultaExternaLaunchError('verification-failed');
    }
    if (data.totalCount != null) {
      if (!Number.isInteger(data.totalCount) || data.totalCount < 0) {
        throw new ConsultaExternaLaunchError('verification-failed');
      }
      expectedTotalCount ??= data.totalCount;
      if (expectedTotalCount !== data.totalCount) {
        throw new ConsultaExternaLaunchError('verification-failed');
      }
    }

    for (const encounter of data.results) {
      if (
        !encounter.uuid ||
        seenEncounterUuids.has(encounter.uuid) ||
        !sameUuid(encounter.patient?.uuid, patientUuid) ||
        !sameUuid(encounter.visit?.uuid, visitUuid) ||
        !sameUuid(encounter.encounterType?.uuid, encounterTypeUuid)
      ) {
        throw new ConsultaExternaLaunchError('verification-failed');
      }
      seenEncounterUuids.add(encounter.uuid);
      if (sameUuid(encounter.form?.uuid, formUuid)) {
        matchingEncounterUuids.push(encounter.uuid);
      }
    }

    const consumed = startIndex + data.results.length;
    const hasNext = data.links?.some((link) => link.rel === 'next') ?? false;
    if (expectedTotalCount != null) {
      if (consumed > expectedTotalCount || (!hasNext && consumed < expectedTotalCount)) {
        throw new ConsultaExternaLaunchError('verification-failed');
      }
      if (consumed === expectedTotalCount) {
        if (hasNext) {
          throw new ConsultaExternaLaunchError('verification-failed');
        }
        break;
      }
    } else if (!hasNext) {
      break;
    }

    if (!data.results.length) {
      throw new ConsultaExternaLaunchError('verification-failed');
    }
    startIndex = consumed;
    if (page === maxPages - 1) {
      throw new ConsultaExternaLaunchError('verification-failed');
    }
  }

  if (matchingEncounterUuids.length > 1) {
    throw new ConsultaExternaLaunchError('multiple-encounters');
  }
  return matchingEncounterUuids[0];
}

/** Anamnesis/SOAP edit one verified encounter; referrals always create a new, visit-attached encounter. */
export function useConsultaExternaFormLauncher({
  patientUuid,
  formIdentifier,
  encounterTypeUuid,
  ambulatoryVisitTypeUuid,
  mutate,
  entryMode,
}: ConsultaExternaFormLauncherOptions): () => void {
  const { t } = useTranslation();
  const patientChartContext = usePatientChartStore(patientUuid);
  const { requireAmbulatoryVisit } = useAmbulatoryVisitGuard({ patientUuid, ambulatoryVisitTypeUuid });
  const launchInProgressRef = useRef(false);

  const showLaunchError = useCallback(
    (subtitle: string) =>
      showSnackbar({
        isLowContrast: false,
        kind: 'error',
        title: t('consultationFormOpenError', 'Could not open the clinical form'),
        subtitle,
      }),
    [t],
  );

  return useCallback(() => {
    if (launchInProgressRef.current) return;
    const currentVisit = requireAmbulatoryVisit();
    if (!currentVisit) return;
    if (!formIdentifier || !encounterTypeUuid) {
      showLaunchError(
        t(
          'consultationFormConfigurationError',
          'This clinical form is not configured. Contact your system administrator.',
        ),
      );
      return;
    }

    launchInProgressRef.current = true;
    void (async () => {
      try {
        const form = await resolvePublishedForm(formIdentifier, encounterTypeUuid);
        const encounterUuid =
          entryMode === 'one-per-visit'
            ? await findSingleEncounterForVisit(patientUuid, currentVisit.uuid, encounterTypeUuid, form.uuid)
            : undefined;
        const handleFormClose = () => {
          launchInProgressRef.current = false;
          try {
            void Promise.resolve(mutate?.()).catch(() => undefined);
          } catch {
            // Cache refresh is best-effort after a safe workspace close.
          }
        };
        const didOpen = await launchWorkspace2(
          patientFormEntryWorkspace,
          {
            workspaceTitle: form.display ?? form.name,
            mutateForm: handleFormClose,
            formInfo: {
              patientUuid,
              formUuid: form.uuid,
              encounterUuid,
              visitUuid: currentVisit.uuid,
              visitTypeUuid: currentVisit.visitType.uuid,
              visitStartDatetime: currentVisit.startDatetime,
              visitStopDatetime: currentVisit.stopDatetime ?? undefined,
            },
          },
          null,
          {
            patientUuid,
            patient: patientChartContext.patient,
            visitContext: currentVisit,
            mutateVisitContext: patientChartContext.mutateVisitContext,
          },
        );
        if (didOpen !== true) {
          throw new ConsultaExternaLaunchError('verification-failed');
        }
        // A successful launch stays locked until mutateForm runs on workspace close.
      } catch (error) {
        launchInProgressRef.current = false;
        if (error instanceof ConsultaExternaLaunchError && error.code === 'multiple-encounters') {
          showLaunchError(
            t(
              'multipleConsultationFormEncounters',
              'More than one record of this form exists in the active visit. Resolve the duplicate before editing.',
            ),
          );
        } else if (error instanceof ConsultaExternaLaunchError && error.code === 'form-unavailable') {
          showLaunchError(
            t(
              'consultationFormUnavailable',
              'The configured clinical form is unavailable or ambiguous. Contact your system administrator.',
            ),
          );
        } else {
          showLaunchError(
            t(
              'consultationFormVerificationError',
              'The existing clinical record could not be verified. Reload and try again.',
            ),
          );
        }
      }
    })();
  }, [
    encounterTypeUuid,
    entryMode,
    formIdentifier,
    mutate,
    patientChartContext.mutateVisitContext,
    patientChartContext.patient,
    patientUuid,
    requireAmbulatoryVisit,
    showLaunchError,
    t,
  ]);
}
