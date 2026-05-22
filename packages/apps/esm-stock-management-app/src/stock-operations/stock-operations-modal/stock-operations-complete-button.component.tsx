import { Button } from '@carbon/react';
import { CheckmarkOutline } from '@carbon/react/icons';
import { showModal } from '@openmrs/esm-framework';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { type StockOperationDTO } from '../../core/api/types/stockOperation/StockOperationDTO';

interface StockOperationCompleteButtonProps {
  operation: StockOperationDTO;
  reason: boolean;
}

const StockOperationCompleteButton: React.FC<StockOperationCompleteButtonProps> = ({ operation, reason }) => {
  const { t } = useTranslation();
  const launchCompleteModal = useCallback(() => {
    const dispose = showModal('stock-operations-modal', {
      title: 'Complete',
      operation: operation,
      requireReason: reason,
      closeModal: () => dispose(),
    });
  }, [operation, reason]);

  return (
    <Button onClick={launchCompleteModal} renderIcon={(props) => <CheckmarkOutline size={16} {...props} />}>
      {t('complete', 'Complete')}
    </Button>
  );
};

export default StockOperationCompleteButton;
