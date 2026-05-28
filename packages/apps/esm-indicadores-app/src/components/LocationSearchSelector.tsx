import React, { useState } from 'react';

import type { LocationOption } from '../api/types';
import { useLocationSearch } from '../features/indicadores/hooks';
import SearchMultiSelector from './SearchMultiSelector';

interface LocationSearchSelectorProps {
  selectedItems: Array<LocationOption>;
  onChange: (items: Array<LocationOption>) => void;
}

const LocationSearchSelector: React.FC<LocationSearchSelectorProps> = ({ selectedItems, onChange }) => {
  const [query, setQuery] = useState('');
  const { data, isLoading, error } = useLocationSearch(query);

  return (
    <SearchMultiSelector
      label="Servicios"
      placeholder="Buscar servicios"
      helperText="Este buscador consulta locations nativas de OpenMRS y las usa como servicios del indicador."
      emptyText="Sin servicios seleccionados."
      noResultsText="No se encontraron servicios con ese criterio."
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

export default LocationSearchSelector;
