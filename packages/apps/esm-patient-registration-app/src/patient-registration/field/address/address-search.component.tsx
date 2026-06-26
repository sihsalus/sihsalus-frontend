import { Search } from '@carbon/react';
import { useFormikContext } from 'formik';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { moduleName } from '../../../constants';
import {
  addressUbigeoField,
  addressUbigeoPathField,
  addressUbigeoPathSeparator,
} from '../../patient-registration-utils';
import { type AddressHierarchySearchResult, useAddressHierarchy } from './address-hierarchy.resource';
import styles from './address-search.scss';
import { type AddressFieldDefinition } from './address-types';

interface AddressSearchComponentProps {
  addressLayout: Array<AddressFieldDefinition>;
  fieldPrefix?: string;
  labelKey?: string;
  labelDefault?: string;
}

const AddressSearchComponent: React.FC<AddressSearchComponentProps> = ({
  addressLayout,
  fieldPrefix = 'address',
  labelKey = 'addressHeader',
  labelDefault = 'Address',
}) => {
  const { t } = useTranslation(moduleName);
  const separator = ' > ';
  const searchBox = useRef(null);
  const wrapper = useRef(null);

  const [searchString, setSearchString] = useState('');
  const [debouncedSearchString, setDebouncedSearchString] = useState('');

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearchString(searchString.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchString]);

  const searchQuery = debouncedSearchString.length >= 3 ? debouncedSearchString : '';
  const addressFields = useMemo(() => addressLayout.map(({ name }) => name), [addressLayout]);
  const { addresses, isLoading, error } = useAddressHierarchy(searchQuery, separator, addressFields);

  const addressOptions: Array<AddressHierarchySearchResult> = useMemo(() => {
    const options = new Map<string, AddressHierarchySearchResult>();
    addresses.forEach((address) => {
      address.segments.forEach((segment, index) => {
        const segmentSearchText = `${segment.name} ${segment.userGeneratedId ?? ''}`.toLowerCase();

        if (segmentSearchText.includes(searchQuery.toLowerCase())) {
          const segments = address.segments.slice(0, index + 1);
          const display = segments.map((currentSegment) => currentSegment.name).join(separator);
          const fieldValues = Object.fromEntries(
            segments
              .filter((currentSegment) => !!currentSegment.addressField)
              .map((currentSegment) => [currentSegment.addressField as string, currentSegment.name]),
          );
          const userGeneratedId = segments[segments.length - 1]?.userGeneratedId;
          const searchText = `${display} ${segments
            .map((currentSegment) => currentSegment.userGeneratedId)
            .filter(Boolean)
            .join(' ')}`.toLowerCase();

          options.set(`${userGeneratedId ?? ''}:${display}`, {
            display,
            fieldValues,
            searchText,
            segments,
            userGeneratedId,
          });
        }
      });
    });
    return [...options.values()];
  }, [addresses, searchQuery]);

  const { setFieldValue } = useFormikContext();

  const handleInputChange = (e) => {
    setSearchString(e.target.value);
  };

  const handleChange = (address: AddressHierarchySearchResult) => {
    if (address) {
      addressLayout.forEach(({ name }) => {
        setFieldValue(`${fieldPrefix}.${name}`, address.fieldValues[name] ?? '', false);
      });
      setFieldValue(`${fieldPrefix}.${addressUbigeoField}`, address.userGeneratedId ?? '', false);
      setFieldValue(
        `${fieldPrefix}.${addressUbigeoPathField}`,
        address.segments.map((segment) => segment.name).join(addressUbigeoPathSeparator),
        false,
      );
      setSearchString('');
      setDebouncedSearchString('');
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapper.current && !wrapper.current.contains(e.target)) {
        setSearchString('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className={styles.autocomplete} ref={wrapper}>
      <span className={styles.searchLabel}>
        {t(labelKey, labelDefault)} ({t('optional', 'optional')})
      </span>
      <Search
        onChange={handleInputChange}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
          }
        }}
        labelText={t('searchAddress', 'Search address')}
        placeholder={t('searchAddress', 'Search address')}
        ref={searchBox}
        value={searchString}
      />
      {searchString && (
        <ul className={styles.suggestions}>
          {searchString.trim().length < 3 ? (
            <li className={styles.noResults}>{t('typeAtLeastThreeCharacters', 'Type at least 3 characters')}</li>
          ) : isLoading ? (
            <li className={styles.loading}>{t('searching', 'Searching...')}</li>
          ) : error ? (
            <li className={styles.noResults}>{t('errorFetchingAddresses', 'Error fetching address results')}</li>
          ) : addressOptions.length > 0 ? (
            addressOptions.map((address) => (
              <li key={`${address.userGeneratedId ?? ''}:${address.display}`}>
                <button type="button" className={styles.suggestionButton} onClick={() => handleChange(address)}>
                  {address.display}
                  {address.userGeneratedId ? ` (${address.userGeneratedId})` : ''}
                </button>
              </li>
            ))
          ) : (
            <li className={styles.noResults}>{t('noAddressResults', 'No matching addresses found')}</li>
          )}
        </ul>
      )}
    </div>
  );
};

export default AddressSearchComponent;
