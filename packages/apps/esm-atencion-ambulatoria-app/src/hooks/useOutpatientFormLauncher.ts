import { getUserFacingErrorMessage, launchWorkspace2, showSnackbar } from '@openmrs/esm-framework';
import { fetchOpenMRSForm, type OpenmrsForm } from '@sihsalus/esm-form-engine-lib';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

const outpatientFormEntryWorkspace = 'patient-form-entry-workspace-v2';

interface UseOutpatientFormLauncherOptions {
  fallbackDisplay: string;
  identifier?: string;
  onSaved?: () => unknown;
  patientUuid: string;
}

type OutpatientWorkspaceForm = OpenmrsForm & {
  display: string;
};

export async function resolveOutpatientForm(
  identifier: string,
  fallbackDisplay: string,
): Promise<OutpatientWorkspaceForm> {
  const form = await fetchOpenMRSForm(identifier);
  if (!form) {
    throw new Error('The outpatient form identifier is empty');
  }

  return {
    ...form,
    display: form.name || fallbackDisplay,
  };
}

export function useOutpatientFormLauncher({
  fallbackDisplay,
  identifier,
  onSaved,
  patientUuid,
}: UseOutpatientFormLauncherOptions) {
  const { t } = useTranslation();
  const normalizedIdentifier = identifier?.trim() || undefined;
  const launchPromiseRef = useRef<Promise<boolean> | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);

  const {
    data: form,
    error,
    isLoading,
  } = useSWR<OutpatientWorkspaceForm, Error>(
    normalizedIdentifier ? `outpatient-form:${normalizedIdentifier}:${fallbackDisplay}` : null,
    () => resolveOutpatientForm(normalizedIdentifier ?? '', fallbackDisplay),
  );

  useEffect(() => {
    if (error) {
      getUserFacingErrorMessage(error, '', { logContext: 'Resolve configured outpatient form' });
    }
  }, [error]);

  const handlePostResponse = useMemo(
    () =>
      onSaved
        ? async () => {
            try {
              await onSaved();
            } catch (refreshError: unknown) {
              getUserFacingErrorMessage(refreshError, '', {
                logContext: 'Refresh outpatient clinical history after form save',
              });
              showSnackbar({
                kind: 'warning',
                title: t('outpatientFormSavedRefreshIncomplete', 'Form saved; history refresh incomplete'),
                subtitle: t(
                  'outpatientFormSavedDoNotSubmitAgain',
                  'The clinical form was saved. Do not submit it again; refresh and review the patient history.',
                ),
              });
            }
          }
        : undefined,
    [onSaved, t],
  );

  const launchForm = useCallback(
    (encounterUuid = ''): Promise<boolean> => {
      if (!normalizedIdentifier) {
        showSnackbar({
          kind: 'warning',
          title: t('outpatientFormNotConfigured', 'Outpatient form not configured'),
          subtitle: t(
            'outpatientFormNotConfiguredSubtitle',
            'No form identifier is configured for this clinical section.',
          ),
        });
        return Promise.resolve(false);
      }

      if (isLoading) {
        showSnackbar({
          kind: 'info',
          title: t('outpatientFormLoading', 'Validating outpatient form'),
          subtitle: t('outpatientFormLoadingSubtitle', 'Wait a moment and try again.'),
        });
        return Promise.resolve(false);
      }

      if (error || !form) {
        showSnackbar({
          kind: 'error',
          title: t('outpatientFormNotAvailable', 'Outpatient form unavailable'),
          subtitle: t(
            'outpatientFormNotAvailableSubtitle',
            'Verify that the configured UUID or exact name identifies one published, non-retired form.',
          ),
        });
        return Promise.resolve(false);
      }

      if (!patientUuid?.trim()) {
        showSnackbar({
          kind: 'error',
          title: t('outpatientFormNotAvailable', 'Outpatient form unavailable'),
          subtitle: t('outpatientFormPatientMissing', 'The patient identity could not be verified.'),
        });
        return Promise.resolve(false);
      }

      if (launchPromiseRef.current) {
        return launchPromiseRef.current;
      }

      setIsLaunching(true);
      const launchPromise = Promise.resolve()
        .then(() => {
          launchWorkspace2(outpatientFormEntryWorkspace, {
            form,
            encounterUuid,
            formInfo: { patientUuid },
            handlePostResponse,
            workspaceTitle: fallbackDisplay,
          });
          return true;
        })
        .catch((launchError: unknown) => {
          getUserFacingErrorMessage(launchError, '', { logContext: 'Launch verified outpatient form' });
          showSnackbar({
            kind: 'error',
            title: t('outpatientFormLaunchError', 'Could not open the outpatient form'),
            subtitle: t('outpatientFormLaunchErrorSubtitle', 'Close other workspaces and try again.'),
          });
          return false;
        })
        .finally(() => {
          if (launchPromiseRef.current === launchPromise) {
            launchPromiseRef.current = null;
          }
          setIsLaunching(false);
        });

      launchPromiseRef.current = launchPromise;
      return launchPromise;
    }, [error, fallbackDisplay, form, handlePostResponse, isLoading, normalizedIdentifier, patientUuid, t]);

  return {
    error,
    form,
    formIdentifier: normalizedIdentifier,
    isLaunching,
    isLoading: Boolean(normalizedIdentifier && isLoading),
    launchForm,
  };
}
