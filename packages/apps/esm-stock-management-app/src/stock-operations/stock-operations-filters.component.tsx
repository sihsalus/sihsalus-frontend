import { DropdownSkeleton, MultiSelect } from '@carbon/react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StockFilters } from '../constants';
import { StockOperationStatusTypes } from '../core/api/types/stockOperation/StockOperationStatus';
import { translateStockOperationStatus, translateStockOperationType } from '../core/utils/translationUtils';
import styles from '../stock-items/stock-items-table.scss';
import { getStockOperationTypes, useConcept } from '../stock-lookups/stock-lookups.resource';

interface StockOperationFiltersProps {
  conceptUuid?: string;
  filterName: string;
  onFilterChange: (selectedItems: any[], filterType: string) => void;
}

const StockOperationsFilters: React.FC<StockOperationFiltersProps> = ({ conceptUuid, onFilterChange, filterName }) => {
  const { t } = useTranslation();
  const { items, isLoading } = useConcept(conceptUuid);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [dataItems, setDataItems] = useState([]);

  const getFilterLabel = (name: string) => {
    switch (name) {
      case StockFilters.STATUS:
        return t('status', 'Estado');
      case StockFilters.SOURCES:
        return t('source', 'Fuente');
      case StockFilters.OPERATION:
        return t('operationType', 'Tipo de Operacion');
      default:
        return name;
    }
  };

  const getItemDisplay = (item) => {
    if (!item) {
      return t('notSet', 'No Definido');
    }

    if (filterName === StockFilters.STATUS) {
      return translateStockOperationStatus(t, item.display);
    }

    if (filterName === StockFilters.OPERATION) {
      return translateStockOperationType(t, item.display);
    }

    return item.display;
  };

  const translatedFilterLabel = getFilterLabel(filterName);

  useEffect(() => {
    setIsDataLoading(true);
    switch (filterName) {
      case StockFilters.STATUS:
        setDataItems(
          StockOperationStatusTypes.map((option) => ({
            uuid: option,
            display: option,
          })),
        );
        break;
      case StockFilters.SOURCES:
        if (items?.answers?.length) {
          setDataItems([...items.answers]);
          setIsDataLoading(isLoading);
        }

        break;
      case StockFilters.OPERATION:
        getStockOperationTypes().then((response) => {
          setIsDataLoading(true);
          if (response.data?.results.length) {
            setDataItems(
              response.data.results
                .filter((result) => !['issue', 'stock issue'].includes(result.name?.trim().toLowerCase()))
                .map((result) => ({
                  uuid: result.uuid,
                  display: result.name,
                })),
            );
          }

          setIsDataLoading(false);
        });
    }
    setIsDataLoading(false);
  }, [filterName, isLoading, items.answers]);

  if (isDataLoading) {
    return <DropdownSkeleton />;
  }

  return (
    <MultiSelect
      autoAlign
      className={styles.filtersAlign}
      disabled={!dataItems.length}
      id="multiSelect"
      label={translatedFilterLabel}
      labelInline
      items={dataItems}
      itemToString={getItemDisplay}
      onChange={({ selectedItems }) => {
        if (selectedItems) {
          onFilterChange(
            selectedItems.map((selectedItem) => selectedItem.uuid),
            filterName,
          );
        }
      }}
      placeholder={t('filterBy', 'Filtrar por {{filterName}}', { filterName: translatedFilterLabel })}
    />
  );
};

export default StockOperationsFilters;
