import { Button } from '@carbon/react';
import { type Order, showModal, useSession, userHasAccess } from '@openmrs/esm-framework';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { laboratoryEditPrivilege } from '../../constants';
import styles from './actions.scss';

interface ApproveLabRequestActionMenuProps {
  order: Order;
}

const ApproveLabRequestAction: React.FC<ApproveLabRequestActionMenuProps> = ({ order }) => {
  const { t } = useTranslation();
  const session = useSession();
  const canEdit = userHasAccess(laboratoryEditPrivilege, session?.user);
  const unsupportedStatuses = ['COMPLETED', 'DECLINED', 'IN_PROGRESS'];

  const launchModal = useCallback(() => {
    const dispose = showModal('approval-lab-results-modal', {
      closeModal: () => dispose(),
      order,
    });
  }, [order]);

  if (!canEdit) {
    return null;
  }

  return (
    <Button
      className={styles.actionButton}
      disabled={unsupportedStatuses.includes(order.fulfillerStatus)}
      size="sm"
      kind="primary"
      key={order.uuid}
      onClick={launchModal}
    >
      {t('approveLabResults', 'Approve lab results')}
    </Button>
  );
};

export default ApproveLabRequestAction;
