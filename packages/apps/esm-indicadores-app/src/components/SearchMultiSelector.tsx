import { Button, InlineLoading, Search, Tile } from '@carbon/react';
import { useDebounce } from '@openmrs/esm-framework';
import { useEffect, useMemo, useState } from 'react';

import styles from '../indicators-dashboard.module.scss';

interface SearchMultiSelectorProps<T> {
  label: string;
  placeholder: string;
  helperText?: string;
  emptyText: string;
  noResultsText: string;
  selectedItems: Array<T>;
  data: Array<T>;
  isLoading: boolean;
  error?: Error | null;
  itemKey: (item: T) => string;
  itemLabel: (item: T) => string;
  onChange: (items: Array<T>) => void;
  onSearchChange: (query: string) => void;
}

function SearchMultiSelector<T>({
  label,
  placeholder,
  helperText,
  emptyText,
  noResultsText,
  selectedItems,
  data,
  isLoading,
  error,
  itemKey,
  itemLabel,
  onChange,
  onSearchChange,
}: SearchMultiSelectorProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm);

  const normalizedQuery = (debouncedSearchTerm ?? '').trim();

  useEffect(() => {
    onSearchChange(normalizedQuery);
  }, [normalizedQuery, onSearchChange]);

  const filteredResults = useMemo(() => {
    const selectedKeys = new Set(selectedItems.map((item) => itemKey(item)));
    return data.filter((item) => !selectedKeys.has(itemKey(item)));
  }, [data, itemKey, selectedItems]);

  const handleAdd = (item: T) => {
    onChange([...selectedItems, item]);
    setSearchTerm('');
  };

  const handleRemove = (item: T) => {
    const targetKey = itemKey(item);
    onChange(selectedItems.filter((current) => itemKey(current) !== targetKey));
  };

  return (
    <div className={styles.searchSelector}>
      <Search
        size="md"
        labelText={label}
        placeholder={placeholder}
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
      />
      {helperText ? <p className={styles.fieldHelp}>{helperText}</p> : null}

      {selectedItems.length ? (
        <div className={styles.selectedItemsList}>
          {selectedItems.map((item) => (
            <span key={itemKey(item)} className={styles.selectedItemPill}>
              <span>{itemLabel(item)}</span>
              <button type="button" className={styles.pillRemoveButton} onClick={() => handleRemove(item)} aria-label={`Quitar ${itemLabel(item)}`}>
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className={styles.fieldHelp}>{emptyText}</p>
      )}

      {normalizedQuery ? (
        <div className={styles.searchResultsPanel}>
          {isLoading ? (
            <InlineLoading description="Buscando..." />
          ) : error ? (
            <div className={styles.errorBanner}>{error.message}</div>
          ) : filteredResults.length ? (
            <div className={styles.searchResultsList} role="listbox" aria-label={label}>
              {filteredResults.map((item) => (
                <Tile key={itemKey(item)} className={styles.searchResultItem}>
                  <div className={styles.searchResultContent}>
                    <span>{itemLabel(item)}</span>
                    <Button size="sm" kind="ghost" onClick={() => handleAdd(item)}>
                      Agregar
                    </Button>
                  </div>
                </Tile>
              ))}
            </div>
          ) : (
            <Tile className={styles.searchEmptyState}>{noResultsText}</Tile>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default SearchMultiSelector;
