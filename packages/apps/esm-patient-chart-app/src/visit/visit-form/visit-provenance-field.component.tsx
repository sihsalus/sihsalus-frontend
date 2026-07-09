import { TextInput } from '@carbon/react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { type ControllerRenderProps } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import styles from './visit-attribute-type.scss';
import { type VisitFormData } from './visit-form.resource';
import {
  normalizeVisitProvenance,
  sanitizeVisitProvenance,
  visitProvenanceMaxLength,
  useVisitProvenanceAddressOptions,
} from './visit-provenance.resource';

interface VisitProvenanceFieldProps {
  disabled?: boolean;
  fieldProps: ControllerRenderProps<VisitFormData, `visitAttributes.${string}`>;
  id: string;
  invalid?: boolean;
  invalidText?: React.ReactNode;
  labelText: React.ReactNode;
  readOnly?: boolean;
}

export function isProvenanceVisitAttributeType(attributeType?: { display?: string; name?: string }) {
  const label = attributeType?.name ?? attributeType?.display ?? '';
  return label.trim().toLocaleLowerCase() === 'procedencia';
}

const VisitProvenanceField: React.FC<VisitProvenanceFieldProps> = ({
  disabled,
  fieldProps,
  id,
  invalid,
  invalidText,
  labelText,
  readOnly,
}) => {
  const { t } = useTranslation();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const value = fieldProps.value ?? '';
  const [debouncedSearchString, setDebouncedSearchString] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const searchString = normalizeVisitProvenance(value);
  const { addresses, error, isLoading } = useVisitProvenanceAddressOptions(showOptions ? debouncedSearchString : '');

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearchString(searchString.length >= 3 ? searchString : '');
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchString]);

  useEffect(() => {
    const listener = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowOptions(false);
      }
    };

    window.addEventListener('mousedown', listener);
    return () => window.removeEventListener('mousedown', listener);
  }, []);

  const addressOptions = useMemo(() => {
    const normalizedValue = searchString.toLocaleLowerCase();
    const options = new Set<string>();

    addresses.forEach((address) => {
      if (!normalizedValue || address.toLocaleLowerCase().includes(normalizedValue)) {
        options.add(address);
      }
    });

    return [...options];
  }, [addresses, searchString]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    fieldProps.onChange(sanitizeVisitProvenance(event.target.value));
    setShowOptions(true);
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    fieldProps.onBlur();
    fieldProps.onChange(normalizeVisitProvenance(event.target.value));
  };

  const handleSelection = (address: string) => {
    fieldProps.onChange(normalizeVisitProvenance(address));
    setShowOptions(false);
  };
  const shouldRenderOptions = showOptions && !readOnly && !disabled && !!value;

  function renderOptions() {
    if (!shouldRenderOptions) {
      return null;
    }

    if (searchString.length < 3) {
      return (
        <div className={styles.provenanceStatus}>{t('typeAtLeastThreeCharacters', 'Type at least 3 characters')}</div>
      );
    }

    if (isLoading) {
      return <div className={styles.provenanceStatus}>{t('searching', 'Searching...')}</div>;
    }

    if (error) {
      return (
        <div className={styles.provenanceStatus}>{t('errorFetchingAddresses', 'Error fetching address results')}</div>
      );
    }

    if (!addressOptions.length) {
      return <div className={styles.provenanceStatus}>{t('noAddressResults', 'No matching addresses found')}</div>;
    }

    return addressOptions.map((address) => (
      <button
        key={address}
        type="button"
        aria-selected={address === value}
        className={styles.provenanceOption}
        role="option"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => handleSelection(address)}
      >
        {address}
      </button>
    ));
  }

  return (
    <div className={styles.provenanceField} ref={wrapperRef}>
      <TextInput
        {...fieldProps}
        autoComplete="off"
        id={id}
        invalid={invalid}
        invalidText={invalidText}
        labelText={labelText}
        maxLength={visitProvenanceMaxLength}
        onBlur={handleBlur}
        onChange={handleChange}
        onFocus={() => setShowOptions(true)}
        placeholder={t('searchProvenance', 'Search or type procedencia')}
        readOnly={readOnly}
        value={value}
        disabled={disabled}
      />
      {shouldRenderOptions ? (
        <div className={styles.provenanceOptions} role="listbox">
          {renderOptions()}
        </div>
      ) : null}
    </div>
  );
};

export default VisitProvenanceField;
