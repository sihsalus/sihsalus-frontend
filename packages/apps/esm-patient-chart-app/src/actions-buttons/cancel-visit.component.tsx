import { OverflowMenuItem } from '@carbon/react';
import { showModal, useSession, useVisit } from '@openmrs/esm-framework';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { canCloseClinicalVisit } from '../visit/visit-access';
import styles from './action-button.scss';

interface CancelVisitOverflowMenuItemProps {
  patientUuid: string;
}

const CancelVisitOverflowMenuItem: React.FC<CancelVisitOverflowMenuItemProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const { user } = useSession();
  const { activeVisit, currentVisit } = useVisit(patientUuid);
  const effectiveVisit = currentVisit ?? activeVisit;
  const canCloseVisit = canCloseClinicalVisit(user);

  const handleLaunchModal = useCallback(() => {
    const dispose = showModal('cancel-visit-dialog', {
      closeModal: () => dispose(),
      patientUuid,
    });
  }, [patientUuid]);

  return (
    canCloseVisit &&
    effectiveVisit && (
      <OverflowMenuItem
        className={styles.menuitem}
        itemText={t('cancelVisit', 'Cancel visit')}
        onClick={handleLaunchModal}
      />
    )
  );
};

export default CancelVisitOverflowMenuItem;
