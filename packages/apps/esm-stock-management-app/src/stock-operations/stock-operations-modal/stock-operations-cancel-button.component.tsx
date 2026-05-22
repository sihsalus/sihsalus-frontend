import { Button } from '@carbon/react';
import { Error as ErrorIcon } from '@carbon/react/icons';
import { showModal } from '@openmrs/esm-framework';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { type StockOperationDTO } from '../../core/api/types/stockOperation/StockOperationDTO';

interface StockOperationCancelButtonProps {
  operation: StockOperationDTO;
}

const StockOperationCancelButton: React.FC<StockOperationCancelButtonProps> = ({ operation }) => {
  const { t } = useTranslation();
  const launchCancelModal = useCallback(() => {
    const dispose = showModal('stock-operations-modal', {
      title: 'Cancel',
      operation: operation,
      requireReason: true,
      closeModal: () => dispose(),
    });
  }, [operation]);

  return (
    <Button onClick={launchCancelModal} kind="danger--ghost" renderIcon={(props) => <ErrorIcon size={16} {...props} />}>
      {t('cancel', 'Cancel ')}
    </Button>
  );
};

export default StockOperationCancelButton;
