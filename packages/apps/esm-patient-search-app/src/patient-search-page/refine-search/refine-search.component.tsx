import { Button, Layer, TextInput } from '@carbon/react';
import { useConfig, useLayoutType } from '@openmrs/esm-framework';
import classNames from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import {
  type BuiltInFieldConfig,
  type PatientSearchConfig,
  type PersonAttributeFieldConfig,
} from '../../config-schema';
import { type AdvancedPatientSearchState, type SearchFieldConfig, type SearchFieldType } from '../../types';
import { identityDocumentNumberAttributeUuid } from './person-attribute-field.component';
import styles from './refine-search.scss';
import { RefineSearchTablet } from './refine-search-tablet.component';
import { SearchField } from './search-field.component';

export const initialFilters: AdvancedPatientSearchState = {
  query: '',
  gender: 'any',
  dateOfBirth: 0,
  monthOfBirth: 0,
  yearOfBirth: 0,
  postcode: '',
  age: -1,
  attributes: {},
};

interface RefineSearchProps {
  inTabletOrOverlay: boolean;
  setFilters: React.Dispatch<React.SetStateAction<AdvancedPatientSearchState>>;
  setSearchQuery?: (query: string) => void;
  filtersApplied: number;
  searchQuery?: string;
}

const RefineSearch: React.FC<RefineSearchProps> = ({
  setFilters,
  setSearchQuery,
  inTabletOrOverlay,
  filtersApplied,
  searchQuery = '',
}) => {
  const [showRefineSearchDialog, setShowRefineSearchDialog] = useState(false);
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const config = useConfig<PatientSearchConfig>();

  const {
    control,
    handleSubmit,
    reset,
    setValue,
  } = useForm<AdvancedPatientSearchState>({
    defaultValues: {
      query: searchQuery,
      gender: 'any',
      dateOfBirth: 0,
      monthOfBirth: 0,
      yearOfBirth: 0,
      age: -1,
      postcode: '',
      attributes: {},
    },
  });

  const queryValue = useWatch({ control, name: 'query' });
  const documentNumberValue = useWatch({
    control,
    name: `attributes.${identityDocumentNumberAttributeUuid}`,
  });
  const hasPrimarySearchCriterion = Boolean(queryValue?.trim() || documentNumberValue?.trim());

  useEffect(() => {
    setValue('query', searchQuery);
  }, [searchQuery, setValue]);

  const onSubmit = useCallback(
    (data: AdvancedPatientSearchState) => {
      const normalizedAttributes = Object.fromEntries(
        Object.entries(data.attributes ?? {}).map(([key, value]) => [key, String(value ?? '').trim()]),
      );
      const normalizedData = {
        ...data,
        query: data.query.trim(),
        attributes: normalizedAttributes,
      };
      const query = normalizedData.query || normalizedAttributes[identityDocumentNumberAttributeUuid] || '';

      if (!query) {
        return;
      }

      setSearchQuery?.(query);
      setFilters(normalizedData);
      setShowRefineSearchDialog(false);
    },
    [setFilters, setSearchQuery],
  );
  const handleResetFields = useCallback(() => {
    const resetFilters = { ...initialFilters, attributes: {} };
    reset(resetFilters);
    setFilters(resetFilters);
    setSearchQuery?.('');
    setShowRefineSearchDialog(false);
  }, [reset, setFilters, setSearchQuery]);

  const toggleShowRefineSearchDialog = useCallback(() => {
    setShowRefineSearchDialog((prevState) => !prevState);
  }, []);

  const renderSearchFields = useMemo(() => {
    const fields: Array<SearchFieldConfig> = [];

    Object.entries(config.search.searchFilterFields).forEach(([fieldName, fieldConfig]) => {
      if (fieldName !== 'personAttributes' && (fieldConfig as BuiltInFieldConfig).enabled) {
        fields.push({
          name: fieldName,
          type: fieldName as SearchFieldType,
        });
      }
    });

    config.search.searchFilterFields.personAttributes?.forEach((attribute: PersonAttributeFieldConfig) => {
      fields.push({
        name: attribute.attributeTypeUuid,
        type: 'personAttribute',
        ...attribute,
      });
    });

    return fields.map((field) => (
      <Layer key={field.name}>
        <div className={styles.field}>
          <SearchField field={field} control={control} inTabletOrOverlay={inTabletOrOverlay} isTablet={isTablet} />
        </div>
      </Layer>
    ));
  }, [config, inTabletOrOverlay, isTablet, control]);

  if (inTabletOrOverlay) {
    return (
      <RefineSearchTablet
        showRefineSearchDialog={showRefineSearchDialog}
        filtersApplied={filtersApplied}
        control={control}
        config={config}
        isTablet={isTablet}
        onResetFields={handleResetFields}
        onToggleDialog={toggleShowRefineSearchDialog}
        onSubmit={handleSubmit(onSubmit)}
        canSubmit={hasPrimarySearchCriterion}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.refineSearchContainer} data-openmrs-role="Refine Search">
      <h2 className={styles.productiveHeading02}>{t('patientSearch', 'Búsqueda de paciente')}</h2>
      <Layer>
        <div className={styles.field}>
          <Controller
            name="query"
            control={control}
            render={({ field: { onChange, value } }) => (
              <TextInput
                id="patient-search-query"
                labelText={t('patientSearchCriteria', 'Apellidos y nombres o documento de identidad')}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange(event.currentTarget.value)}
                placeholder={t('patientSearchCriteriaPlaceholder', 'Ingrese apellidos, nombres, DNI, CE o pasaporte')}
                size={isTablet ? 'lg' : 'md'}
                value={value ?? ''}
              />
            )}
          />
        </div>
      </Layer>
      <h3 className={styles.sectionHeading}>{t('refineSearch', 'Refine search')}</h3>
      {renderSearchFields}
      <hr className={classNames(styles.field, styles.horizontalDivider)} />
      <Button
        type="submit"
        kind="primary"
        size="md"
        disabled={!hasPrimarySearchCriterion}
        className={classNames(styles.field, styles.button)}
      >
        {t('search', 'Search')}{' '}
        {filtersApplied
          ? `(${t('countOfFiltersApplied', '{{count}} filters applied', { count: filtersApplied })})`
          : null}
      </Button>
      <Button
        type="button"
        kind="secondary"
        size="md"
        onClick={handleResetFields}
        className={classNames(styles.field, styles.button)}
      >
        {t('resetFields', 'Reset fields')}
      </Button>
    </form>
  );
};

export default RefineSearch;
