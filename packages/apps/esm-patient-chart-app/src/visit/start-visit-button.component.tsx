import { Button } from '@carbon/react';
import { getUserFacingErrorMessage, showSnackbar, useConnectivity, useSession } from '@openmrs/esm-framework';
import { fetchFreshPatientVitalStatus, launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { canManuallyStartVisit } from './visit-access';

interface StartVisitButtonProps {
  patientUuid: string;
}

const StartVisitButton = ({ patientUuid }: StartVisitButtonProps) => {
  const { t } = useTranslation();
  const { user } = useSession();
  const isOnline = useConnectivity();
  const startVisitWorkspaceForm = 'start-visit-workspace-form';
  const canStart = canManuallyStartVisit(user);

  const handleStartVisit = useCallback(async () => {
    try {
      if (isOnline) {
        const vitalStatus = await fetchFreshPatientVitalStatus(patientUuid);
        if (vitalStatus.isDeceased) {
          throw new DeceasedPatientVisitError('A visit cannot be started for a deceased patient.');
        }
      }
      launchPatientWorkspace(startVisitWorkspaceForm, {
        patientUuid,
        openedFrom: 'patient-chart-start-visit',
        showPatientHeader: true,
      });
    } catch (error) {
      showSnackbar({
        isLowContrast: false,
        kind: 'error',
        title: t('errorStartingVisit', 'Error starting visit'),
        subtitle: getUserFacingErrorMessage(
          error,
          t(
            vitalStatusErrorMessageKey(error),
            error instanceof DeceasedPatientVisitError
              ? 'No se puede iniciar una consulta para un paciente fallecido.'
              : 'No se pudo verificar el estado vital. Intente nuevamente antes de iniciar la consulta.',
          ),
          { logContext: 'Launch start visit workspace' },
        ),
      });
    }
  }, [isOnline, patientUuid, t]);

  return canStart ? (
    <Button aria-label={t('startVisit', 'Start visit')} kind="primary" onClick={handleStartVisit}>
      {t('startVisit', 'Start visit')}
    </Button>
  ) : null;
};

class DeceasedPatientVisitError extends Error {}

function vitalStatusErrorMessageKey(error: unknown) {
  return error instanceof DeceasedPatientVisitError
    ? 'deceasedPatientVisitBlocked'
    : 'patientVitalStatusCheckFailedBeforeVisit';
}

export default StartVisitButton;
