import { ComboBox, InlineLoading, InlineNotification } from '@carbon/react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { NationalityConceptAnswer } from '../patient-nationality.resource';

interface NationalityConceptFieldProps {
  disabled?: boolean;
  error?: Error;
  invalidText?: string;
  isLoading: boolean;
  onChange: (conceptUuid: string) => void;
  options?: Array<NationalityConceptAnswer>;
  value?: string;
}

export function NationalityConceptField({
  disabled,
  error,
  invalidText,
  isLoading,
  onChange,
  options,
  value,
}: NationalityConceptFieldProps) {
  const { t } = useTranslation();
  const sortedOptions = useMemo(
    () => [...(options ?? [])].sort((a, b) => a.display.localeCompare(b.display)),
    [options],
  );
  const selectedNationality = sortedOptions.find((option) => option.uuid === value) ?? null;

  if (isLoading) {
    return <InlineLoading description={t('loadingNationalities', 'Cargando nacionalidades...')} />;
  }

  if (error) {
    return (
      <InlineNotification
        kind="error"
        lowContrast
        title={t('nationalityCatalogUnavailable', 'No se pudo cargar el catálogo de nacionalidades')}
      />
    );
  }

  if (!sortedOptions.length) {
    return (
      <InlineNotification
        kind="error"
        lowContrast
        title={t('nationalityCatalogEmpty', 'El catálogo de nacionalidades está vacío')}
      />
    );
  }

  return (
    <ComboBox
      id="nationality"
      titleText={t('nationality', 'Nacionalidad')}
      placeholder={t('selectNationality', 'Busque y seleccione una nacionalidad')}
      items={sortedOptions}
      itemToString={(option) => option?.display ?? ''}
      selectedItem={selectedNationality}
      disabled={disabled}
      invalid={Boolean(invalidText)}
      invalidText={invalidText}
      onChange={({ selectedItem }) => onChange(selectedItem?.uuid ?? '')}
    />
  );
}
