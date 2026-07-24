import { ComboBox, DropdownSkeleton, InlineLoading, Layer } from '@carbon/react';
import { type OpenmrsResource } from '@openmrs/esm-framework/src/internal';
import { debounce } from 'lodash-es';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import useDataSourceDependentValue from '../../../hooks/useDataSourceDependentValue';
import { useFormProviderContext } from '../../../provider/form-provider';
import { getControlTemplate } from '../../../registry/inbuilt-components/control-templates';
import { getRegisteredDataSource } from '../../../registry/registry';
import { type DataSource, type FormFieldInputProps } from '../../../types';
import { isTrue } from '../../../utils/boolean-utils';
import { isViewMode } from '../../../utils/common-utils';
import { shouldUseInlineLayout } from '../../../utils/form-helper';
import { isEmpty } from '../../../validators/form-validator';
import FieldLabel from '../../field-label/field-label.component';
import FieldValueView from '../../value/view/field-value-view.component';
import styles from './ui-select-extended.scss';

type SelectItem = OpenmrsResource & { uuid: string; display?: string };

const toSelectItem = (item: OpenmrsResource): SelectItem => ({
  ...item,
  uuid: String(item.uuid ?? ''),
  display: typeof item.display === 'string' ? item.display : undefined,
});

const UiSelectExtended: React.FC<FormFieldInputProps<string | null | undefined>> = ({
  field,
  errors,
  warnings: _warnings,
  setFieldValue,
}) => {
  const { t } = useTranslation();
  const [items, setItems] = useState<SelectItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const isProcessingSelection = useRef(false);
  const [dataSource, setDataSource] = useState<DataSource<OpenmrsResource> | null>(null);
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const dataSourceDependentValue = useDataSourceDependentValue(field);
  const isSearchable = isTrue(field.questionOptions.isSearchable);
  const {
    layoutType,
    sessionMode,
    workspaceLayout,
    methods: { control, getFieldState },
  } = useFormProviderContext();

  const value = useWatch({ control, name: field.id, exact: true }) as string | null | undefined;
  const { isDirty } = getFieldState(field.id);

  const isInline = useMemo(() => {
    if (isViewMode(sessionMode) || isTrue(field.readonly)) {
      return shouldUseInlineLayout(field.inlineRendering, layoutType, workspaceLayout, sessionMode);
    }
    return false;
  }, [sessionMode, field.readonly, field.inlineRendering, layoutType, workspaceLayout]);

  const selectedItem = useMemo<SelectItem | null>(
    () => items.find((item) => item.uuid === value) ?? null,
    [items, value],
  );

  const debouncedSearch = useMemo(
    () =>
      debounce((nextSearchTerm: string, nextDataSource: DataSource<OpenmrsResource>) => {
        setIsSearching(true);

        void nextDataSource
          .fetchData(nextSearchTerm, config)
          .then((dataItems) => {
            if (dataItems.length) {
              const currentSelectedItem = items.find((item) => item.uuid === value);
              const newItems = dataItems.map((item) => toSelectItem(nextDataSource.toUuidAndDisplay(item)));
              if (currentSelectedItem && !newItems.some((item) => item.uuid === currentSelectedItem.uuid)) {
                newItems.unshift(currentSelectedItem);
              }
              setItems(newItems);
            }
            setIsSearching(false);
          })
          .catch((err: unknown) => {
            console.error(err);
            setIsSearching(false);
          });
      }, 300),
    [config, items, value],
  );

  const searchTermHasMatchingItem = useCallback(
    (searchValue: string): boolean => {
      return items.some((item) => item.display?.toLowerCase().includes(searchValue.toLowerCase()) ?? false);
    },
    [items],
  );

  useEffect(() => {
    const dataSourceName = field.questionOptions?.datasource?.name;
    setConfig(
      dataSourceName
        ? field.questionOptions.datasource?.config
        : (getControlTemplate(field.questionOptions.rendering)?.datasource?.config ?? {}),
    );
    void getRegisteredDataSource(dataSourceName ?? field.questionOptions.rendering).then((ds) => setDataSource(ds));
  }, [field.questionOptions?.datasource, field.questionOptions.rendering]);

  useEffect(() => {
    let ignore = false;

    // If not searchable, preload the items
    if (dataSource && !isSearchable) {
      setItems([]);
      setIsLoading(true);

      void dataSource
        .fetchData(null, { ...config, referencedValue: dataSourceDependentValue })
        .then((dataItems) => {
          if (!ignore) {
            setItems(dataItems.map((item) => toSelectItem(dataSource.toUuidAndDisplay(item))));
            setIsLoading(false);
          }
        })
        .catch((err: unknown) => {
          if (!ignore) {
            console.error(err);
            setIsLoading(false);
            setItems([]);
          }
        });
    }

    return (): void => {
      ignore = true;
    };
  }, [config, dataSource, dataSourceDependentValue, isSearchable]);

  useEffect(() => {
    if (dataSource && isSearchable && !isEmpty(searchTerm) && !searchTermHasMatchingItem(searchTerm)) {
      debouncedSearch(searchTerm, dataSource);
    }
  }, [dataSource, debouncedSearch, isSearchable, searchTerm, searchTermHasMatchingItem]);

  useEffect(() => {
    let ignore = false;
    if (value && !isDirty && dataSource && isSearchable && !items.length) {
      // Search-based fields only load options after typing. Resolve an initial
      // value explicitly so encounter defaults are visible in create mode and
      // previously saved values remain visible in edit mode.
      setIsLoading(true);
      void dataSource
        .fetchSingleItem(value)
        .then((item) => {
          if (!ignore) {
            setItems(item ? [toSelectItem(dataSource.toUuidAndDisplay(item))] : []);
            setIsLoading(false);
          }
        })
        .catch((error: unknown) => {
          if (!ignore) {
            console.error(error);
            setIsLoading(false);
          }
        });
    }

    return (): void => {
      ignore = true;
    };
  }, [dataSource, isDirty, isSearchable, items.length, value]);

  if (isLoading) {
    return <DropdownSkeleton />;
  }

  return isViewMode(sessionMode) || isTrue(field.readonly) ? (
    <FieldValueView
      label={t(field.label)}
      value={value ? items.find((item) => item.uuid === value)?.display : value}
      conceptName={field.meta?.concept?.display}
      isInline={isInline}
    />
  ) : (
    !field.isHidden && (
      <div className={styles.boldedLabel}>
        <Layer>
          <ComboBox
            id={field.id}
            titleText={<FieldLabel field={field} />}
            items={items}
            itemToString={(item?: SelectItem | null) => item?.display ?? ''}
            selectedItem={selectedItem}
            placeholder={isSearchable ? t('search', 'Search') + '...' : null}
            onChange={({ selectedItem }) => {
              isProcessingSelection.current = true;
              setFieldValue(selectedItem?.uuid ?? null);
            }}
            disabled={field.isDisabled}
            readOnly={isTrue(field.readonly)}
            invalid={errors.length > 0}
            invalidText={errors.length && errors[0].message}
            onInputChange={(nextValue): void => {
              if (isProcessingSelection.current) {
                // Notes:
                // When the user selects a value, both the onChange and onInputChange functions are invoked sequentially.
                // Issue: onInputChange modifies the search term, unnecessarily triggering a search.
                isProcessingSelection.current = false;
                return;
              }
              if (field.questionOptions.isSearchable) {
                setSearchTerm(nextValue);
              }
            }}
            onBlur={(event): void => {
              // Notes:
              // There is an issue with the onBlur event where the value is not persistently set to null when the user clears the input field.
              // This is a workaround to ensure that the value is set to null when the user clears the input field.
              if (!event.target.value) {
                setFieldValue(null);
              }
            }}
          />
          {isSearching && <InlineLoading className={styles.loader} description={t('searching', 'Searching') + '...'} />}
        </Layer>
      </div>
    )
  );
};

export default UiSelectExtended;
