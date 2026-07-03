import { Button } from '@carbon/react';
import { type Order, showModal, useSession, userHasAccess } from '@openmrs/esm-framework';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { laboratoryEditPrivilege } from '../../constants';
import styles from './actions.scss';

interface RejectLabRequestActionProps {
  order: Order;
}

const RejectLabRequestAction: React.FC<RejectLabRequestActionProps> = ({ order }) => {
  const { t } = useTranslation();
  const session = useSession();
  const canEdit = userHasAccess(laboratoryEditPrivilege, session?.user);
  const unsupportedStatuses = ['COMPLETED', 'DECLINED'];

  const launchRejectLabRequestModal = useCallback(() => {
    const dispose = showModal('reject-lab-request-modal', {
      closeModal: () => dispose(),
      order,
    });
  }, [order]);

  if (!canEdit) {
    return null;
  }

  return (
    <Button
      kind="danger--tertiary"
      className={styles.actionRejectButton}
      disabled={unsupportedStatuses.includes(order.fulfillerStatus)}
      key={order.uuid}
      size="sm"
      onClick={launchRejectLabRequestModal}
    >
      {t('rejectLabRequest', 'Reject lab request')}
    </Button>
  );
};

export default RejectLabRequestAction;
