import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { EncounterTypeOption } from '../api/types';
import { useEncounterTypeSearch } from '../features/indicadores/hooks';
import SearchMultiSelector from './SearchMultiSelector';

interface EncounterTypeSearchSelectorProps {
  selectedItems: Array<EncounterTypeOption>;
  onChange: (items: Array<EncounterTypeOption>) => void;
}

const EncounterTypeSearchSelector: React.FC<EncounterTypeSearchSelectorProps> = ({ selectedItems, onChange }) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const { data, isLoading, error } = useEncounterTypeSearch(query);

  return (
    <SearchMultiSelector
      label={t('encounterTypes', 'Tipos de encuentro')}
      placeholder={t('searchEncounterTypes', 'Buscar tipos de encuentro')}
      helperText={t('encounterTypesHelperText', 'Filtra por el tipo de atención del evento, por ejemplo CRED.')}
      emptyText={t('noEncounterTypesSelected', 'Sin tipos de encuentro seleccionados.')}
      noResultsText={t('noEncounterTypesFound', 'No se encontraron tipos de encuentro con ese criterio.')}
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

export default EncounterTypeSearchSelector;
