import { InlineLoading } from '@carbon/react';
import { showSnackbar } from '@openmrs/esm-framework';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { stockManagementOperationsEditPrivilege } from '../constants';
import { useStockOperationTypes } from '../stock-lookups/stock-lookups.resource';
import { launchStockoperationAddOrEditWorkSpace } from './stock-operation.utils';
import { useStockOperationAndItems } from './stock-operations.resource';

interface StockOperationReferenceProps {
  operationUuid: string;
  operationNumber: string;
}

const StockOperationReference = ({ operationNumber, operationUuid }: StockOperationReferenceProps) => {
  const { t } = useTranslation();
  const { types, isLoading: istypesLoading, error: typesError } = useStockOperationTypes();
  const {
    items: stockOperation,
    error: stockOperationError,
    isLoading: isStockOperationloading,
  } = useStockOperationAndItems(operationUuid ?? null);

  const handleEdit = useCallback(() => {
    const operationType = types.results?.find((op) => op?.uuid === stockOperation?.operationTypeUuid);
    if (!operationType) {
      return;
    }
    launchStockoperationAddOrEditWorkSpace(
      t,
      operationType,
      stockOperation,
      stockOperation?.requisitionStockOperationUuid,
    );
  }, [stockOperation, t, types.results]);

  useEffect(() => {
    if (stockOperationError) {
      showSnackbar({
        title: t('errorLoadingStockOperation', 'Error loading stock operation'),
        subtitle: stockOperationError?.message,
        kind: 'error',
      });
    }
    if (typesError) {
      showSnackbar({
        title: t('errorLoadingStockOperationTypes', 'Error loading stock operation types'),
        subtitle: typesError?.message,
        kind: 'error',
      });
    }
  }, [stockOperationError, typesError, t]);

  if (istypesLoading || isStockOperationloading) {
    return <InlineLoading description={t('loading', 'Loading')} />;
  }

  if (!stockOperation?.permission?.canEdit) {
    return <span>{operationNumber}</span>;
  }

  return (
    <RequirePrivilege privilege={stockManagementOperationsEditPrivilege} fallback={<span>{operationNumber}</span>}>
      <button
        type="button"
        onClick={handleEdit}
        style={{ background: 'none', border: 0, color: 'inherit', cursor: 'pointer', padding: 0 }}
      >
        {operationNumber}
      </button>
    </RequirePrivilege>
  );
};

export default StockOperationReference;
