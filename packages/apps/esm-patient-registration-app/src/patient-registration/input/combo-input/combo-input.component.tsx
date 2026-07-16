import { Layer, TextInput } from '@carbon/react';
import classNames from 'classnames';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { moduleName } from '../../../constants';
import styles from '../input.scss';
import SelectionTick from './selection-tick.component';

interface ComboInputProps {
  entries: Array<string>;
  error?: Error;
  isLoading?: boolean;
  name: string;
  fieldProps: {
    value: string;
    labelText: string;
    [x: string]: any;
  };
  handleInputChange: (newValue: string) => void;
  handleSelection: (newSelection: string) => void;
}

const ComboMenuItem: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="cds--list-box__menu-item">
    <div className={classNames('cds--list-box__menu-item__option', styles.comboInputItemOption)}>{children}</div>
  </div>
);

const ComboInput: React.FC<ComboInputProps> = ({
  entries,
  error,
  isLoading,
  fieldProps,
  handleInputChange,
  handleSelection,
}) => {
  const { t } = useTranslation(moduleName);
  const [highlightedEntry, setHighlightedEntry] = useState(-1);
  const { required, value = '', ...inputProps } = fieldProps;
  const [showEntries, setShowEntries] = useState(false);
  const comboInputRef = useRef<HTMLDivElement>(null);

  const handleFocus = useCallback(() => {
    setShowEntries(true);
    setHighlightedEntry(-1);
  }, []);

  const filteredEntries = useMemo(() => {
    if (!entries) {
      return [];
    }
    if (!value) {
      return entries;
    }
    return entries.filter((entry) => entry.toLowerCase().includes(value.toLowerCase()));
  }, [entries, value]);

  const handleOptionClick = useCallback(
    (newSelection: string) => {
      handleSelection(newSelection);
      setShowEntries(false);
    },
    [handleSelection],
  );

  const handleKeyPress = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      const totalResults = filteredEntries.length;

      if (event.key === 'Tab') {
        setShowEntries(false);
        setHighlightedEntry(-1);
      }

      if (event.key === 'ArrowUp') {
        setHighlightedEntry((prev) => Math.max(-1, prev - 1));
      } else if (event.key === 'ArrowDown') {
        setHighlightedEntry((prev) => Math.min(totalResults - 1, prev + 1));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (highlightedEntry > -1) {
          handleOptionClick(filteredEntries[highlightedEntry]);
        }
      }
    },
    [highlightedEntry, handleOptionClick, filteredEntries],
  );

  useEffect(() => {
    const listener = (event: MouseEvent) => {
      if (comboInputRef.current && !comboInputRef.current.contains(event.target as Node)) {
        setShowEntries(false);
        setHighlightedEntry(-1);
      }
    };
    globalThis.addEventListener('click', listener);
    return () => {
      globalThis.removeEventListener('click', listener);
    };
  }, []);

  const renderDropdownContent = () => {
    if (isLoading) return <ComboMenuItem>{t('searching', 'Searching...')}</ComboMenuItem>;
    if (error) return <ComboMenuItem>{t('errorFetchingResults', 'Error fetching results')}</ComboMenuItem>;
    if (filteredEntries.length > 0) {
      return filteredEntries.map((entry, indx) => (
        <div
          className={classNames('cds--list-box__menu-item', {
            'cds--list-box__menu-item--highlighted': indx === highlightedEntry,
          })}
          key={indx}
          id={`downshift-1-item-${indx}`}
          role="option"
          tabIndex={-1}
          aria-selected={entry === value}
          onClick={() => handleOptionClick(entry)}
        >
          <div
            className={classNames('cds--list-box__menu-item__option', styles.comboInputItemOption, {
              'cds--list-box__menu-item--active': entry === value,
            })}
          >
            {entry}
            {entry === value && <SelectionTick />}
          </div>
        </div>
      ));
    }
    if (value) return <ComboMenuItem>{t('noMatchingResults', 'No matching results')}</ComboMenuItem>;
    return null;
  };

  return (
    <div className={styles.comboInput} ref={comboInputRef}>
      <Layer>
        <TextInput
          {...inputProps}
          value={value}
          aria-required={required || undefined}
          id={fieldProps.id ?? fieldProps.name ?? 'combo-input'}
          onChange={(e) => {
            setHighlightedEntry(-1);
            handleInputChange(e.target.value);
          }}
          onFocus={handleFocus}
          autoComplete={'off'}
          onKeyDown={handleKeyPress}
        />
      </Layer>
      <div className={styles.comboInputEntries}>
        {showEntries && (
          <div className="cds--combo-box cds--list-box cds--list-box--expanded">
            <div id="downshift-1-menu" className="cds--list-box__menu" role="listbox">
              {renderDropdownContent()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComboInput;
