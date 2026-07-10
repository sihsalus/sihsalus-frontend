import { ComboBox, InlineLoading, InlineNotification, TextInput, TextInputSkeleton } from '@carbon/react';
import { type OpenmrsResource } from '@openmrs/esm-framework';
import type { TFunction } from 'i18next';
import React, { useMemo, useRef, useState } from 'react';
import { type Control, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { type AdvancedPatientSearchState, type SearchFieldConfig } from '../../types';

import {
  useAttributeConceptAnswers,
  useConfiguredAnswerConcepts,
  useLocations,
  usePersonAttributeType,
} from './person-attributes.resource';
import styles from './search-field.scss';

export const identityDocumentTypeAttributeUuid = '6f5c0b8a-9e91-4d41-9a8c-8b0f3c2e7a11';
export const identityDocumentNumberAttributeUuid = 'c0d1a2b3-4e5f-4a6b-9c7d-8e9f0a1b2c3d';
export const identityDocumentAttributeUuids = [
  identityDocumentTypeAttributeUuid,
  identityDocumentNumberAttributeUuid,
] as const;

function getPersonAttributeDisplayLabel(attributeDisplay: string, attributeTypeUuid: string | undefined, t: TFunction) {
  if (attributeTypeUuid === identityDocumentNumberAttributeUuid) {
    return t('identityDocumentNumber', 'Número de Documento de Identidad');
  }

  return t(attributeDisplay);
}

export function isMissingPersonAttributeTypeError(error: unknown) {
  const responseStatus = getErrorStatus(error);

  return responseStatus === 404 || (error instanceof Error && /\b404\b/.test(error.message));
}

function getErrorStatus(error: unknown) {
  return typeof error === 'object' && error
    ? ((error as { response?: { status?: number }; status?: number }).response?.status ??
        (error as { status?: number }).status)
    : undefined;
}

function isForbiddenError(error: unknown) {
  return getErrorStatus(error) === 403 || (error instanceof Error && /\b403\b/.test(error.message));
}

export function sanitizePersonAttributeText(value: string, disallowNumbers?: boolean) {
  const text = Array.from(value)
    .filter((char) => {
      const charCode = char.charCodeAt(0);
      return charCode >= 32 && charCode !== 127;
    })
    .join('');

  if (!disallowNumbers) {
    return text;
  }

  return text.replace(/[^\p{L}\s.'-]/gu, '').replace(/\s{2,}/g, ' ');
}

export interface PersonAttributeFieldProps {
  field: SearchFieldConfig;
  control: Control<AdvancedPatientSearchState>;
  inTabletOrOverlay: boolean;
  isTablet: boolean;
}

export function PersonAttributeField({ field, control, isTablet }: PersonAttributeFieldProps) {
  const { t } = useTranslation();
  const { data: personAttributeType, isLoading, error } = usePersonAttributeType(field.attributeTypeUuid || '');

  const formatField = useMemo(() => {
    if (!field.attributeTypeUuid) {
      return null;
    }

    if (!personAttributeType || isLoading) {
      return <TextInputSkeleton />;
    }

    switch (personAttributeType.format) {
      case 'java.lang.String': {
        const labelText = getPersonAttributeDisplayLabel(personAttributeType.display, field.attributeTypeUuid, t);

        if (field.stringAnswerOptions?.length) {
          return (
            <StringAttributeOptionsField
              field={field}
              control={control}
              isTablet={isTablet}
              attributeDisplay={personAttributeType.display}
            />
          );
        }

        return (
          <Controller
            name={`attributes.${field.name}`}
            control={control}
            defaultValue=""
            render={({ field: { onChange, value } }) => (
              <TextInput
                id={field.name}
                labelText={labelText}
                value={value || ''}
                onChange={(e) => onChange(sanitizePersonAttributeText(e.target.value, field.disallowNumbers))}
                placeholder={field.placeholder}
                size={isTablet ? 'lg' : 'md'}
                maxLength={80}
              />
            )}
          />
        );
      }

      case 'org.openmrs.Concept':
        return (
          <ConceptAttributeField
            field={field}
            control={control}
            isTablet={isTablet}
            attributeDisplay={personAttributeType.display}
          />
        );

      case 'org.openmrs.Location':
        return (
          <LocationAttributeField
            field={field}
            control={control}
            isTablet={isTablet}
            attributeDisplay={personAttributeType.display}
          />
        );

      default:
        return (
          <InlineNotification kind="error" title={t('error', 'Error')}>
            {t('unsupportedAttributeFormat', 'Unsupported attribute format: {{format}}', {
              format: personAttributeType.format,
            })}
          </InlineNotification>
        );
    }
  }, [personAttributeType, isLoading, field, control, t, isTablet]);

  if (error) {
    return null;
  }

  return formatField;
}

interface StringAttributeOptionsFieldProps {
  field: SearchFieldConfig;
  control: Control<AdvancedPatientSearchState>;
  isTablet: boolean;
  attributeDisplay: string;
}

const StringAttributeOptionsField: React.FC<StringAttributeOptionsFieldProps> = ({
  field,
  control,
  isTablet,
  attributeDisplay,
}) => {
  const { t } = useTranslation();
  const items = field.stringAnswerOptions ?? [];

  return (
    <Controller
      name={`attributes.${field.name}`}
      control={control}
      defaultValue=""
      render={({ field: { onChange, value } }) => (
        <ComboBox
          id={field.name}
          titleText={t(attributeDisplay)}
          items={items}
          itemToString={(item) => item?.label ?? ''}
          selectedItem={items.find((item) => item.value === value)}
          onChange={({ selectedItem }) => onChange(selectedItem?.value ?? '')}
          placeholder={field.placeholder ?? t('selectOption', 'Select an option')}
          size={isTablet ? 'lg' : 'md'}
        />
      )}
    />
  );
};

interface ConceptAttributeFieldProps {
  field: SearchFieldConfig;
  control: Control<AdvancedPatientSearchState>;
  isTablet: boolean;
  attributeDisplay: string;
}

const ConceptAttributeField: React.FC<ConceptAttributeFieldProps> = ({
  field,
  control,
  isTablet,
  attributeDisplay,
}) => {
  const { t } = useTranslation();
  const { configuredConceptAnswers, isLoadingConfiguredAnswers } = useConfiguredAnswerConcepts(
    field.conceptAnswersUuids ?? [],
  );
  const { conceptAnswers, isLoadingConceptAnswers, errorFetchingConceptAnswers } = useAttributeConceptAnswers(
    field.conceptAnswersUuids?.length ? '' : field.answerConceptSetUuid,
  );

  const items = useMemo(() => {
    if (isLoadingConceptAnswers || isLoadingConfiguredAnswers) return [];
    if (field.conceptAnswersUuids?.length) return configuredConceptAnswers || [];
    return conceptAnswers || [];
  }, [
    isLoadingConceptAnswers,
    isLoadingConfiguredAnswers,
    field.conceptAnswersUuids,
    configuredConceptAnswers,
    conceptAnswers,
  ]);

  if (isLoadingConceptAnswers || isLoadingConfiguredAnswers) {
    return <TextInputSkeleton />;
  }

  if (errorFetchingConceptAnswers) {
    if (isForbiddenError(errorFetchingConceptAnswers)) {
      return null;
    }

    return (
      <InlineNotification kind="error" title={t('error', 'Error')}>
        {t('errorLoadingConceptAttributeAnswers', 'Error loading concept attribute answers')}
      </InlineNotification>
    );
  }

  return (
    <Controller
      name={`attributes.${field.name}`}
      control={control}
      defaultValue=""
      render={({ field: { onChange, value } }) => (
        <ComboBox
          id={field.name}
          titleText={t(attributeDisplay)}
          items={items}
          itemToString={(item: OpenmrsResource) => item?.display}
          selectedItem={items.sort((a, b) => a.display.localeCompare(b.display)).find((item) => item.uuid === value)}
          onChange={({ selectedItem }) => onChange(selectedItem?.uuid)}
          placeholder={field.placeholder ?? t('selectOption', 'Select an option')}
          size={isTablet ? 'lg' : 'md'}
        />
      )}
    />
  );
};

interface LocationAttributeFieldProps {
  field: SearchFieldConfig;
  control: Control<AdvancedPatientSearchState>;
  isTablet: boolean;
  attributeDisplay: string;
}

const LocationAttributeField: React.FC<LocationAttributeFieldProps> = ({
  field,
  control,
  isTablet,
  attributeDisplay,
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const { locations, isLoading, loadingNewData, error } = useLocations(field.locationTag || null, searchQuery);
  const prevLocationOptions = useRef([]);

  const locationOptions = useMemo(() => {
    if (!(isLoading && loadingNewData)) {
      const newOptions = locations.map(({ resource }) => ({
        value: resource.id,
        label: resource.name,
      }));
      prevLocationOptions.current = newOptions;
      return newOptions;
    }
    return prevLocationOptions.current;
  }, [locations, isLoading, loadingNewData]);

  if (error) {
    return (
      <InlineNotification kind="error" title={t('error', 'Error')}>
        {t('errorLoadingLocationsForAttribute', 'Error loading locations for person attribute {{attributeName}}', {
          attributeName: attributeDisplay,
        })}
      </InlineNotification>
    );
  }

  return (
    <div className={styles.locationAttributeFieldContainer}>
      <Controller
        name={`attributes.${field.name}`}
        control={control}
        defaultValue=""
        render={({ field: { onChange, value } }) => (
          <ComboBox
            id={field.name}
            titleText={t(attributeDisplay)}
            items={locationOptions}
            selectedItem={locationOptions.find((option) => option.value === value)}
            onChange={({ selectedItem }) => onChange(selectedItem?.value)}
            onInputChange={(inputValue) => {
              if (inputValue && !locationOptions.find(({ label }) => label === inputValue)) {
                setSearchQuery(inputValue);
                onChange('');
              }
            }}
            placeholder={t('searchLocationPersonAttribute', 'Search location')}
            size={isTablet ? 'lg' : 'md'}
            typeahead
          />
        )}
      />
      {loadingNewData && (
        <div className={styles.loadingContainer}>
          <InlineLoading />
        </div>
      )}
    </div>
  );
};
