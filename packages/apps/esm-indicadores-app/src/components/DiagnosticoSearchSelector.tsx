import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { DiagnosticoOption } from '../api/types';
import { useDiagnosticoSearch } from '../features/indicadores/hooks';
import SearchMultiSelector from './SearchMultiSelector';

interface DiagnosticoSearchSelectorProps {
  selectedItems: Array<DiagnosticoOption>;
  onChange: (items: Array<DiagnosticoOption>) => void;
}

const DiagnosticoSearchSelector: React.FC<DiagnosticoSearchSelectorProps> = ({ selectedItems, onChange }) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const { data, isLoading, error } = useDiagnosticoSearch(query);

  return (
    <SearchMultiSelector
      label={t('diagnostics', 'Diagnósticos')}
      placeholder={t('searchDiagnostics', 'Buscar diagnósticos')}
      helperText={t('diagnosticsHelperText', 'Agregue uno o más diagnósticos al filtro clínico del indicador.')}
      emptyText={t('noDiagnosticsSelected', 'Sin diagnósticos seleccionados.')}
      noResultsText={t('noDiagnosticsFound', 'No se encontraron diagnósticos con ese criterio.')}
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
