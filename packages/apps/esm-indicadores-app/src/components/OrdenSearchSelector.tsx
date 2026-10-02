import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { OrdenOption } from '../api/types';
import { useOrdenSearch } from '../features/indicadores/hooks';
import SearchMultiSelector from './SearchMultiSelector';

interface OrdenSearchSelectorProps {
  selectedItems: Array<OrdenOption>;
  onChange: (items: Array<OrdenOption>) => void;
}

const OrdenSearchSelector: React.FC<OrdenSearchSelectorProps> = ({ selectedItems, onChange }) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const { data, isLoading, error } = useOrdenSearch(query);

  return (
    <SearchMultiSelector
      label={t('orders', 'Órdenes')}
      placeholder={t('searchOrders', 'Buscar órdenes o conceptos')}
      helperText={t('ordersHelperText', 'Agregue las órdenes clínicas relevantes para este indicador.')}
      emptyText={t('noOrdersSelected', 'Sin órdenes seleccionadas.')}
      noResultsText={t('noOrdersFound', 'No se encontraron órdenes con ese criterio.')}
      selectedItems={selectedItems}
      data={data}
      isLoading={isLoading}
      error={error}
      itemKey={(item) => item.uuid}
      itemLabel={(item) => item.display}
      onChange={onChange}
      onSearchChange={setQuery}
    />
  );
};

export default OrdenSearchSelector;
