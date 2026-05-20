import { type SearchProps as CarbonSearchProps, Layer, Search } from '@carbon/react';
import classNames from 'classnames';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import styles from './autosuggest.scss';

interface AutosuggestProps extends Omit<CarbonSearchProps, 'onChange' | 'onClear'> {
  getDisplayValue: Function;
  getFieldValue: Function;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getSearchResults: (query: string) => Promise<any>;
  onSuggestionSelected: (field: string, value: string) => void;
  invalid?: boolean | undefined;
  invalidText?: string | undefined;
}

export const Autosuggest: React.FC<AutosuggestProps> = ({
  getDisplayValue,
  getFieldValue,
  getSearchResults,
  onSuggestionSelected,
  invalid,
  invalidText,
  ...searchProps
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const searchBox = useRef<HTMLInputElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const { id: name, labelText } = searchProps;

  const handleClickOutsideComponent = useCallback((event: MouseEvent) => {
    if (wrapper.current && !wrapper.current.contains(event.target as Node)) {
      setSuggestions([]);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutsideComponent);

    return () => {
      document.removeEventListener('mousedown', handleClickOutsideComponent);
    };
  }, [handleClickOutsideComponent]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    onSuggestionSelected(name ?? '', undefined);

    if (query) {
      getSearchResults(query).then((suggestions) => {
        setSuggestions(suggestions);
      });
    } else {
      setSuggestions([]);
    }
  };

  const handleClear = () => {
    onSuggestionSelected(name ?? '', undefined);
  };

  const handleClick = (index: number) => {
    const display = getDisplayValue(suggestions[index]);
    const value = getFieldValue(suggestions[index]);
    if (searchBox.current) {
      searchBox.current.value = display;
    }
    onSuggestionSelected(name ?? '', value);
    setSuggestions([]);
  };

  return (
    <div className={styles.autocomplete} ref={wrapper}>
      <label className="cds--label">{labelText}</label>
      <Layer className={classNames({ [styles.invalid]: invalid })}>
        <Search
          {...searchProps}
          id="autosuggest"
          onChange={handleChange}
          onClear={handleClear}
          ref={searchBox}
          className={styles.autocompleteSearch}
        />
      </Layer>
      {suggestions.length > 0 && (
        <ul className={styles.suggestions}>
          {suggestions.map((suggestion, index) => (
            <li key={index} onClick={(e) => handleClick(index)}>
              {getDisplayValue(suggestion)}
            </li>
          ))}
        </ul>
      )}
      {invalid ? <label className={classNames(styles.invalidMsg)}>{invalidText}</label> : <></>}
    </div>
  );
};
