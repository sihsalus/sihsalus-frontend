import { Button, Layer, TextInput } from '@carbon/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useConfig, useLayoutType } from '@openmrs/esm-framework';
import { normalizePatientAgeRange } from '@openmrs/esm-utils';
import classNames from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import {
  type BuiltInFieldConfig,
  type PatientSearchConfig,
  type PersonAttributeFieldConfig,
} from '../../config-schema';
import {
  isPatientSearchTermValid,
  MAX_PATIENT_SEARCH_CHARACTERS,
  MIN_PATIENT_SEARCH_CHARACTERS,
  normalizePatientSearchTerm,
} from '../../patient-search-constants';
import { type AdvancedPatientSearchState, type SearchFieldConfig, type SearchFieldType } from '../../types';
import styles from './refine-search.scss';
import { createRefineSearchSchema } from './refine-search.validation';
import { RefineSearchTablet } from './refine-search-tablet.component';
import { SearchField } from './search-field.component';

export const initialFilters: AdvancedPatientSearchState = {
  query: '',
  gender: 'any',
  postcode: '',
  age: null,
  ageUnit: 'years',
  hasActiveVisit: false,
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
  const { minimumAge, maximumAge } = normalizePatientAgeRange(
    config.search.searchFilterFields.age.min,
    config.search.searchFilterFields.age.max,
  );
  const validationSchema = useMemo(
    () => createRefineSearchSchema(t, minimumAge, maximumAge),
    [maximumAge, minimumAge, t],
  );

  const { control, handleSubmit, reset, setValue } = useForm<AdvancedPatientSearchState>({
    resolver: zodResolver(validationSchema),
    mode: 'onBlur',
    defaultValues: {
      query: searchQuery,
      gender: 'any',
      age: null,
      ageUnit: 'years',
      hasActiveVisit: false,
      postcode: '',
      attributes: {},
    },
  });

  const queryValue = useWatch({ control, name: 'query' });
  const hasPrimarySearchCriterion = isPatientSearchTermValid(queryValue);
  const queryIsTooShort = Boolean(queryValue?.trim()) && !hasPrimarySearchCriterion;

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
        query: normalizePatientSearchTerm(data.query),
        attributes: normalizedAttributes,
      };
      const query = normalizedData.query;

      if (!isPatientSearchTermValid(query)) {
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
        const { min, max } = fieldConfig as BuiltInFieldConfig;
        fields.push({
          name: fieldName,
          type: fieldName as SearchFieldType,
          min,
          max,
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
                placeholder={t('searchForPatient', 'Search for a patient by name or identifier number')}
                size={isTablet ? 'lg' : 'md'}
                value={value ?? ''}
                maxLength={MAX_PATIENT_SEARCH_CHARACTERS}
                invalid={queryIsTooShort}
                invalidText={t('minimumSearchCharacters', 'Enter at least {{count}} characters', {
                  count: MIN_PATIENT_SEARCH_CHARACTERS,
                })}
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
