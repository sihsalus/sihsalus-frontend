import { Button, Search } from '@carbon/react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  isPatientSearchTermValid,
  limitPatientSearchTerm,
  MAX_PATIENT_SEARCH_CHARACTERS,
} from '../patient-search-constants';
import styles from './patient-search-bar.scss';

// Carbon forwards native input attributes, although SearchProps does not currently expose maxLength.
const searchInputLengthProps = { maxLength: MAX_PATIENT_SEARCH_CHARACTERS };

interface PatientSearchBarProps {
  buttonProps?: Omit<React.ComponentProps<typeof Button>, 'children' | 'onClick' | 'size' | 'type'>;
  initialSearchTerm?: string;
  onChange?: (searchTerm: string) => void;
  onClear: () => void;
  onInputFocus?: React.FocusEventHandler<HTMLInputElement>;
  onSubmit: (searchTerm: string) => void;
  isCompact?: boolean;
}

const PatientSearchBar = React.forwardRef<HTMLInputElement, React.PropsWithChildren<PatientSearchBarProps>>(
  ({ buttonProps, initialSearchTerm = '', onChange, onClear, onInputFocus, onSubmit, isCompact }, ref) => {
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState(() => limitPatientSearchTerm(initialSearchTerm));
    const responsiveSize = isCompact ? 'sm' : 'lg';

    const handleChange = useCallback(
      (value: string) => {
        const limitedValue = limitPatientSearchTerm(value);
        setSearchTerm(limitedValue);
        onChange?.(limitedValue);
      },
      [onChange],
    );

    const handleSubmit = useCallback(
      (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (isPatientSearchTermValid(searchTerm)) {
          onSubmit(searchTerm.trim());
        }
      },
      [onSubmit, searchTerm],
    );

    const handleClear = useCallback(() => {
      setSearchTerm('');
      onChange?.('');
      onClear();
    }, [onChange, onClear]);

    return (
      <form onSubmit={handleSubmit} className={styles.searchArea}>
        <Search
          {...searchInputLengthProps}
          autoFocus
          className={styles.patientSearchInput}
          closeButtonLabelText={t('clearSearch', 'Clear')}
          data-testid="patientSearchBar"
          labelText=""
          onChange={(event) => handleChange(event.target.value)}
          onClear={handleClear}
          onFocus={onInputFocus}
          placeholder={t('searchForPatient', 'Search for a patient by name or identifier number')}
          ref={ref}
          size={responsiveSize}
          value={searchTerm}
        />
        <Button
          kind="secondary"
          {...buttonProps}
          disabled={buttonProps?.disabled || !isPatientSearchTermValid(searchTerm)}
          size={responsiveSize}
          type="submit"
        >
          {t('search', 'Search')}
        </Button>
      </form>
    );
  },
);

export default PatientSearchBar;
