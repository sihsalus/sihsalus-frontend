import { Button } from '@carbon/react';
import { showSnackbar, type Workspace2DefinitionProps } from '@openmrs/esm-framework';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

interface StartVisitButtonProps {
  patientUuid: string;
  patient: fhir.Patient;
  startVisitWorkspaceName: string;
  startVisitWorkspaceProps?: object;
  launchChildWorkspace: Workspace2DefinitionProps['launchChildWorkspace'];
}

/**
 * This button shows up in search results patient cards for patients with no active visit
 */
const StartVisitButton2 = ({
  patientUuid,
  patient,
  startVisitWorkspaceName,
  startVisitWorkspaceProps,
  launchChildWorkspace,
}: StartVisitButtonProps) => {
  const { t } = useTranslation();

  const handleStartVisit = useCallback(async () => {
    try {
      await launchChildWorkspace(startVisitWorkspaceName, {
        openedFrom: 'patient-search-results',
        ...startVisitWorkspaceProps,
        patient,
        patientUuid,
      });
    } catch (error) {
      console.error('Error launching visit form workspace:', error);

      showSnackbar({
        isLowContrast: false,
        kind: 'error',
        title: t('errorStartingVisit', 'Error starting visit'),
        subtitle: error.message ?? t('errorStartingVisitDescription', 'An error occurred while starting the visit'),
      });
    }
  }, [patientUuid, t, launchChildWorkspace, patient, startVisitWorkspaceName, startVisitWorkspaceProps]);

  return (
    <Button aria-label={t('startVisit', 'Start visit')} kind="primary" onClick={handleStartVisit}>
      {t('startVisit', 'Start visit')}
    </Button>
  );
};

export default StartVisitButton2;
