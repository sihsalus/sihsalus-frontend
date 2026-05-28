import React, { useState } from 'react';

import type { OrdenOption } from '../api/types';
import { useOrdenSearch } from '../features/indicadores/hooks';
import SearchMultiSelector from './SearchMultiSelector';

interface OrdenSearchSelectorProps {
  selectedItems: Array<OrdenOption>;
  onChange: (items: Array<OrdenOption>) => void;
}

const OrdenSearchSelector: React.FC<OrdenSearchSelectorProps> = ({ selectedItems, onChange }) => {
  const [query, setQuery] = useState('');
  const { data, isLoading, error } = useOrdenSearch(query);

  return (
    <SearchMultiSelector
      label="Órdenes"
      placeholder="Buscar órdenes o conceptos"
      helperText="Agregá las órdenes clínicas relevantes para este indicador."
      emptyText="Sin órdenes seleccionadas."
      noResultsText="No se encontraron órdenes con ese criterio."
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
