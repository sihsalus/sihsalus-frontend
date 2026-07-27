import { Dropdown, DropdownSkeleton } from '@carbon/react';
import { getUserFacingErrorMessage, showSnackbar, useConfig } from '@openmrs/esm-framework';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { type ConfigObject } from '../../config-schema';
import { useConcept } from '../../stock-lookups/stock-lookups.resource';
import styles from './stock-sources-filter.scss';

const StockSourcesFilter: React.FC<{
  onFilterChange: (selectedSourceType: string) => void;
}> = ({ onFilterChange }) => {
  const { t } = useTranslation();
  const { stockSourceTypeUUID } = useConfig<ConfigObject>();
  const { items, isLoading, error } = useConcept(stockSourceTypeUUID);

  useEffect(() => {
    if (error) {
      showSnackbar({
        title: t('errorFetchingStockSourceTypes', 'Error fetching stock source types'),
        subtitle: getUserFacingErrorMessage(
          error,
          t('errorFetchingStockSourceTypesMessage', 'No se pudieron cargar los tipos de origen. Intente nuevamente.'),
          { logContext: 'Load stock source types' },
        ),
        kind: 'error',
        isLowContrast: true,
      });
    }
  }, [error, t]);

  if (isLoading) {
    return <DropdownSkeleton size="sm" />;
  }

  if (Object.keys(items).length === 0) {
    return null;
  }

  return (
    <div className={styles.filterContainer}>
      <Dropdown
        id="stockSourcesFilter"
        initialSelectedItem={items?.answers?.[0]}
        items={[...(items?.answers || [])]}
        itemToString={(item) => (item ? item.display : t('notSet', 'Not Set'))}
        label=""
        onChange={({ selectedItem }) => onFilterChange(selectedItem?.display)}
        size="sm"
        titleText={t('selectSourceType', 'Select source type')}
        type="inline"
      />
    </div>
  );
};

export default StockSourcesFilter;
