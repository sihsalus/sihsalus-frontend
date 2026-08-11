import { Button } from '@carbon/react';
import { getUserFacingErrorMessage, showSnackbar, useSession } from '@openmrs/esm-framework';
import { launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { canManuallyStartVisit } from './visit-access';

interface StartVisitButtonProps {
  patientUuid: string;
}

const StartVisitButton = ({ patientUuid }: StartVisitButtonProps) => {
  const { t } = useTranslation();
  const { user } = useSession();
  const startVisitWorkspaceForm = 'start-visit-workspace-form';
  const canStart = canManuallyStartVisit(user);

  const handleStartVisit = useCallback(() => {
    try {
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
          t('errorStartingVisitDescription', 'Ocurrió un error al iniciar la consulta. Intente nuevamente.'),
          { logContext: 'Launch start visit workspace' },
        ),
      });
    }
  }, [patientUuid, t]);

  return canStart ? (
    <Button aria-label={t('startVisit', 'Start visit')} kind="primary" onClick={handleStartVisit}>
      {t('startVisit', 'Start visit')}
    </Button>
  ) : null;
};

export default StartVisitButton;
