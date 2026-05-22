import { Button } from '@carbon/react';
import { CheckmarkOutline } from '@carbon/react/icons';
import { showModal } from '@openmrs/esm-framework';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { type StockOperationDTO } from '../../core/api/types/stockOperation/StockOperationDTO';

interface StockOperationApprovalButtonProps {
  operation: StockOperationDTO;
}

const StockOperationApprovalButton: React.FC<StockOperationApprovalButtonProps> = ({ operation }) => {
  const { t } = useTranslation();
  const launchApprovalModal = useCallback(() => {
    const dispose = showModal('stock-operations-modal', {
      title: 'Approve',
      operation: operation,
      requireReason: false,
      closeModal: () => dispose(),
    });
  }, [operation]);

  return (
    <Button onClick={launchApprovalModal} renderIcon={(props) => <CheckmarkOutline size={16} {...props} />}>
      {t('approve', 'Approve')}
    </Button>
  );
};

export default StockOperationApprovalButton;
