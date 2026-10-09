import { Button, InlineLoading, Search, Tile } from '@carbon/react';
import { getUserFacingErrorMessage, useDebounce } from '@openmrs/esm-framework';
import { type FocusEvent, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { indicatorsErrorMessageOptions } from '../features/indicadores/error-handling';
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
  /** When true, the option list is shown on focus even before typing. */
  showResultsOnFocus?: boolean;
  /** Called on focus; term-based callers use it to fetch a first page. */
  onActivate?: () => void;
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
  showResultsOnFocus = false,
  onActivate,
}: SearchMultiSelectorProps<T>) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [isFocused, setFocused] = useState(false);
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

  // On focus the option list is revealed. Encounter types already carry the full
  // list; term-based sources fetch their first page via `onActivate`.
  const showResults = normalizedQuery !== '' || (isFocused && showResultsOnFocus);

  const handleFocus = () => {
    setFocused(true);
    onActivate?.();
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setFocused(false);
    }
  };

  return (
    <div className={styles.searchSelector} role="group" onFocus={handleFocus} onBlur={handleBlur}>
      <p className={styles.fieldLabel}>{label}</p>
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
              <button
                type="button"
                className={styles.pillRemoveButton}
                onClick={() => handleRemove(item)}
                aria-label={t('removeItem', 'Quitar {{label}}', { label: itemLabel(item) })}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className={styles.fieldHelp}>{emptyText}</p>
      )}

      {showResults ? (
        <div className={styles.searchResultsPanel}>
          {isLoading ? (
            <InlineLoading description={t('searching', 'Buscando...')} />
          ) : error ? (
            <div className={styles.errorBanner}>
              {getUserFacingErrorMessage(
                error,
                t('optionsLoadFailed', 'No se pudieron cargar las opciones.'),
                indicatorsErrorMessageOptions(t),
              )}
            </div>
          ) : filteredResults.length ? (
            <div className={styles.searchResultsList} role="list" aria-label={label}>
              {filteredResults.map((item) => (
                <Tile
                  key={itemKey(item)}
                  className={styles.searchResultItem}
                  role="listitem"
                  onClick={() => handleAdd(item)}
                >
                  <div className={styles.searchResultContent}>
                    <span>{itemLabel(item)}</span>
                    <Button
                      size="sm"
                      kind="ghost"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleAdd(item);
                      }}
                    >
                      {t('add', 'Agregar')}
                    </Button>
                  </div>
                </Tile>
              ))}
            </div>
          ) : normalizedQuery ? (
            <Tile className={styles.searchEmptyState}>{noResultsText}</Tile>
          ) : (
            <Tile className={styles.searchEmptyState}>
              {t('searchPrompt', 'Escriba para buscar opciones.')}
            </Tile>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default SearchMultiSelector;
