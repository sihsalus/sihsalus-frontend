import { showSnackbar, useConfig } from '@openmrs/esm-framework';
import { launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../config-schema';
import { patientFormEntryWorkspace } from '../utils/constants';
import { resolvePublishedForm } from './useConsultaExternaFormLauncher';

/** Verify the existing content contract before handing either entry point to the shared form workspace. */
export function useSocialHistoryFormLauncher(patientUuid: string, mutate?: () => unknown) {
  const { t } = useTranslation();
  const { clinicalEncounterUuid, formsList } = useConfig<ConfigObject>();
  const formIdentifier = formsList?.clinicalEncounterFormUuid;
  const source = useMemo(
    () => ({ patientUuid, formIdentifier, clinicalEncounterUuid }),
    [patientUuid, formIdentifier, clinicalEncounterUuid],
  );
  const pending = useRef<{ source: typeof source } | null>(null);

  useEffect(() => {
    return () => {
      if (pending.current?.source === source) pending.current = null;
    };
  }, [source]);

  return useCallback(async () => {
    if (pending.current) return false;
    const request = { source };
    pending.current = request;
    try {
      if (!patientUuid || !formIdentifier || !clinicalEncounterUuid) throw new Error('missing-content-configuration');
      const form = await resolvePublishedForm(formIdentifier, clinicalEncounterUuid);
      if (pending.current !== request) return false;
      launchPatientWorkspace(patientFormEntryWorkspace, {
        workspaceTitle: t('socialHistory', 'Social History'),
        mutateForm: mutate,
        formInfo: {
          encounterUuid: '',
          formUuid: form.uuid,
          patientUuid,
          visitTypeUuid: '',
          visitUuid: '',
        },
      });
      return true;
    } catch {
      if (pending.current === request) {
        showSnackbar({
          kind: 'error',
          title: t('consultationFormOpenError', 'Could not open the clinical form'),
          subtitle: t(
            'socialHistoryFormUnavailable',
            'The social history form could not be verified. Try again or contact your system administrator.',
          ),
        });
      }
      return false;
    } finally {
      if (pending.current === request) pending.current = null;
    }
  }, [clinicalEncounterUuid, formIdentifier, mutate, patientUuid, source, t]);
}
