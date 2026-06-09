import { Search } from '@carbon/react';
import { useFormikContext } from 'formik';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { moduleName } from '../../../constants';
import { useAddressHierarchy } from './address-hierarchy.resource';
import styles from './address-search.scss';

interface AddressLayoutField {
  name: string;
}

interface AddressSearchComponentProps {
  addressLayout: Array<AddressLayoutField>;
}

const AddressSearchComponent: React.FC<AddressSearchComponentProps> = ({ addressLayout }) => {
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
  const { addresses, isLoading, error } = useAddressHierarchy(searchQuery, separator);

  const addressOptions: Array<string> = useMemo(() => {
    const options: Set<string> = new Set();
    addresses.forEach((address) => {
      const values = address.split(separator);
      values.forEach((val, index) => {
        if (val.toLowerCase().includes(searchQuery.toLowerCase())) {
          options.add(values.slice(0, index + 1).join(separator));
        }
      });
    });
    return [...options];
  }, [addresses, searchQuery]);

  const { setFieldValue } = useFormikContext();

  const handleInputChange = (e) => {
    setSearchString(e.target.value);
  };

  const handleChange = (address) => {
    if (address) {
      const values = address.split(separator);
      addressLayout.forEach(({ name }, index) => {
        setFieldValue(`address.${name}`, values?.[index] ?? '', false);
      });
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
      <span className={styles.searchLabel}>{t('addressHeader', 'Address')} ({t('optional', 'optional')})</span>
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
              <li key={address}>
                <button className={styles.suggestionButton} type="button" onClick={() => handleChange(address)}>
                  {address}
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
