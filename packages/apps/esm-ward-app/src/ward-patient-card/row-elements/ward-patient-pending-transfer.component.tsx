import { IconButton } from '@carbon/react';
import { Movement } from '@carbon/react/icons';
import { CloseOutlineIcon, launchWorkspace2, useSession, userHasAccess } from '@openmrs/esm-framework';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { wardEditPrivilege } from '../../constant';
import { type WardPatient } from '../../types';
import styles from '../ward-patient-card.scss';

export interface WardPatientTransferProps {
  wardPatient: WardPatient;
}

const WardPatientPendingTransfer: React.FC<WardPatientTransferProps> = ({ wardPatient }) => {
  const { t } = useTranslation();
  const session = useSession();
  const canEdit = userHasAccess(wardEditPrivilege, session?.user);

  const { dispositionType, dispositionLocation } = wardPatient.inpatientRequest ?? {};
  const message = useMemo(() => {
    if (dispositionType === 'TRANSFER') {
      if (dispositionLocation) {
        return t('transferToDispositionLocation', 'Transfer to {{location}}', { location: dispositionLocation.name });
      }
      return t('pendingTransfer', 'Pending Transfer');
    }
    if (dispositionType === 'DISCHARGE') {
      return t('pendingDischarge', 'Pending Discharge');
    }
    return '';
  }, [dispositionType, dispositionLocation, t]);

  const launchCancelAdmissionForm = () => {
    launchWorkspace2(
      'ward-patient-cancel-admission-request-workspace',
      {},
      {},
      {
        wardPatient,
      },
    );
  };

  if (!(dispositionType === 'TRANSFER' || dispositionType === 'DISCHARGE')) return null;

  return (
    <div className={styles.wardPatientCardDispositionTypeContainer}>
      <Movement className={styles.movementIcon} size={24} />
      {message}
      {canEdit && (
        <IconButton
          label={t('cancel', 'Cancel')}
          kind={'secondary'}
          className={styles.cancelTransferRequestButton}
          size={'sm'}
          onClick={launchCancelAdmissionForm}
        >
          <CloseOutlineIcon />
        </IconButton>
      )}
    </div>
  );
};

export default WardPatientPendingTransfer;
