import { Button, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { navigate, useConnectivity, useFeatureFlag, useSession } from '@openmrs/esm-framework';
import { launchPatientChartWithWorkspaceOpen, launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { canManuallyStartVisit } from '../visit-access';

import styles from './start-visit-dialog.scss';

interface StartVisitDialogProps {
  patientUuid: string;
  closeModal: () => void;
  visitType: string;
  launchPatientChart?: boolean;
  newVisitOnly?: boolean;
  dashboardName?: string;
}

const StartVisitDialog: React.FC<StartVisitDialogProps> = ({
  patientUuid,
  closeModal,
  visitType,
  launchPatientChart,
  newVisitOnly = false,
  dashboardName,
}) => {
  const { t } = useTranslation();
  const rdeFeatureEnabled = useFeatureFlag('rde');
  const isOnline = useConnectivity();
  const session = useSession();
  const canStartNewVisit = !newVisitOnly || (isOnline && session?.authenticated && canManuallyStartVisit(session.user));

  const handleEditPastVisit = useCallback(() => {
    navigate({ to: '${openmrsSpaBase}/patient/' + `${patientUuid}/chart/Visits` });
    closeModal();
  }, [closeModal, patientUuid]);

  const handleStartNewVisit = useCallback(() => {
    if (!canStartNewVisit) {
      return;
    }
    if (launchPatientChart) {
      launchPatientChartWithWorkspaceOpen({
        patientUuid,
        workspaceName: 'start-visit-workspace-form',
        ...(dashboardName ? { dashboardName } : {}),
        additionalProps: { openedFrom: 'patient-chart-start-visit' },
      });
    } else {
      launchPatientWorkspace('start-visit-workspace-form', { openedFrom: 'patient-chart-start-visit' });
    }

    closeModal();
  }, [canStartNewVisit, closeModal, patientUuid, launchPatientChart, dashboardName]);

  const modalHeaderText =
    !newVisitOnly && rdeFeatureEnabled && visitType === 'past'
      ? t('addAPastVisit', 'Add a past visit')
      : t('noActiveVisit', 'No active visit');

  const modalBodyText = newVisitOnly
    ? t(
        'closedVisitStartNewVisitText',
        'La consulta anterior está cerrada. Inicie una nueva consulta para continuar la atención. La consulta anterior y la interconsulta se conservan.',
      )
    : rdeFeatureEnabled
      ? visitType === 'past'
        ? t(
            'addPastVisitText',
            'You can add a new past visit or update an old one. Choose from one of the options below to continue.',
          )
        : t(
            'noActiveVisitText',
            "You can't add data to the patient chart without an active visit. Choose from one of the options below to continue.",
          )
      : t(
          'noActiveVisitNoRDEText',
          "You can't add data to the patient chart without an active visit. Would you like to start a new visit?",
        );

  return (
    <div>
      <ModalHeader closeModal={closeModal}>
        <span className={styles.header}>{modalHeaderText}</span>
      </ModalHeader>
      <ModalBody>
        <p className={styles.body}>{modalBodyText}</p>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeModal}>
          {t('cancel', 'Cancel')}
        </Button>
        {!newVisitOnly && rdeFeatureEnabled && (
          <Button kind="secondary" onClick={handleEditPastVisit}>
            {t('editPastVisit', 'Edit past visit')}
          </Button>
        )}
        <Button kind="primary" disabled={!canStartNewVisit} onClick={handleStartNewVisit}>
          {t('startNewVisit', 'Start new visit')}
        </Button>
      </ModalFooter>
    </div>
  );
};

export default StartVisitDialog;
