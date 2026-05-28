import React, { useState } from 'react';

import type { DiagnosticoOption } from '../api/types';
import { useDiagnosticoSearch } from '../features/indicadores/hooks';
import SearchMultiSelector from './SearchMultiSelector';

interface DiagnosticoSearchSelectorProps {
  selectedItems: Array<DiagnosticoOption>;
  onChange: (items: Array<DiagnosticoOption>) => void;
}

const DiagnosticoSearchSelector: React.FC<DiagnosticoSearchSelectorProps> = ({ selectedItems, onChange }) => {
  const [query, setQuery] = useState('');
  const { data, isLoading, error } = useDiagnosticoSearch(query);

  return (
    <SearchMultiSelector
      label="Diagnósticos"
      placeholder="Buscar diagnósticos"
      helperText="Agregá uno o más diagnósticos al filtro clínico del indicador."
      emptyText="Sin diagnósticos seleccionados."
      noResultsText="No se encontraron diagnósticos con ese criterio."
      selectedItems={selectedItems}
      data={data}
      isLoading={isLoading}
      error={error}
      itemKey={(item) => item.uuid}
      itemLabel={(item) => (item.codigo ? `${item.codigo} · ${item.nombre}` : item.nombre)}
      onChange={onChange}
      onSearchChange={setQuery}
    />
  );
};

export default DiagnosticoSearchSelector;
