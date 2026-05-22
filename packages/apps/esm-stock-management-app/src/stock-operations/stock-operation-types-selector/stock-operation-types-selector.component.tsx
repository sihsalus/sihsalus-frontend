import { ButtonSkeleton, OverflowMenu, OverflowMenuItem } from '@carbon/react';
import { OverflowMenuVertical } from '@carbon/react/icons';
import { showSnackbar } from '@openmrs/esm-framework';
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { OperationType, type StockOperationType } from '../../core/api/types/stockOperation/StockOperationType';
import { translateStockOperationType } from '../../core/utils/translationUtils';
import { launchStockoperationAddOrEditWorkSpace } from '../stock-operation.utils';
import useFilteredOperationTypesByRoles from '../stock-operations-forms/hooks/useFilteredOperationTypesByRoles';

const StockOperationTypesSelector = () => {
  const { t } = useTranslation();
  const { error, isLoading, operationTypes } = useFilteredOperationTypesByRoles();

  const handleSelect = useCallback(
    (stockOperationType: StockOperationType) => {
      launchStockoperationAddOrEditWorkSpace(t, stockOperationType, undefined);
    },
    [t],
  );

  useEffect(() => {
    if (error) {
      showSnackbar({
        kind: 'error',
        title: t('stockOperationTypesError', 'Error loading stock operation types'),
        subtitle: error?.message,
      });
    }
  }, [error, t]);

  if (isLoading) return <ButtonSkeleton />;

  if (error) return null;

  return operationTypes && operationTypes.length ? (
    <OverflowMenu
      renderIcon={() => (
        <>
          {t('startNew', 'Start New')}&nbsp;&nbsp;
          <OverflowMenuVertical size={16} />
        </>
      )}
      menuOffset={{ top: 0, left: -100 }}
      style={{
        backgroundColor: '#007d79',
        backgroundImage: 'none',
        color: '#fff',
        minHeight: '1rem',
        padding: '.95rem !important',
        width: '8rem',
        marginRight: '0.5rem',
        whiteSpace: 'nowrap',
      }}
    >
      {operationTypes
        .filter((op) => op.operationType !== OperationType.STOCK_ISSUE_OPERATION_TYPE)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((operation) => (
          <OverflowMenuItem
            key={operation.uuid}
            itemText={translateStockOperationType(t, operation.name)}
            onClick={() => {
              handleSelect(operation);
            }}
          />
        ))}
    </OverflowMenu>
  ) : null;
};

export default StockOperationTypesSelector;
