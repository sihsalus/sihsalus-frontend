import { Checkbox, CheckboxGroup, FilterableMultiSelect, Layer, Tag } from '@carbon/react';
import React, { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormProviderContext } from '../../../provider/form-provider';
import { type FormFieldInputProps, type FormFieldValue } from '../../../types';
import { isTrue } from '../../../utils/boolean-utils';
import { shouldUseInlineLayout } from '../../../utils/form-helper';
import FieldLabel from '../../field-label/field-label.component';
import { ValueEmpty } from '../../value/value.component';
import FieldValueView from '../../value/view/field-value-view.component';
import styles from './multi-select.scss';

interface SelectOption {
  id: string;
  concept: string;
  label: string;
  key: number;
  disabled?: boolean;
  readonly: boolean;
}

const MultiSelect: React.FC<FormFieldInputProps<string[]>> = ({ field, value, errors, warnings, setFieldValue }) => {
  const { t } = useTranslation();
  const { layoutType, sessionMode, workspaceLayout, formFieldAdapters } = useFormProviderContext();
  const validationMessageId = useId();
  const validationDescriptionId =
    !isTrue(field.readonly) && (errors.length > 0 || warnings.length > 0) ? validationMessageId : undefined;

  const selectOptions = field.questionOptions.answers
    .filter((answer) => !answer.isHidden)
    .map((answer, index) => ({
      id: `${field.id}-${answer.concept}`,
      concept: answer.concept,
      label: t(answer.label),
      key: index,
      disabled: answer.disable?.isDisabled,
      readonly: isTrue(field.readonly),
    }));

  const selectedQuestionItems = selectOptions.filter((item) => value?.includes(item.concept));

  const handleSelectItemsChange = ({ selectedItems }: { selectedItems: SelectOption[] }): void => {
    setFieldValue(selectedItems.map((selectedItem) => selectedItem.concept));
  };

  const isSearchable = useMemo(
    () => isTrue(field.questionOptions.isCheckboxSearchable),
    [field.questionOptions.isCheckboxSearchable],
  );

  const handleSelectCheckbox = (option: SelectOption): void => {
    const selectedValue = option.concept;
    const selectedValues = value ?? [];
    const updatedItems = selectedValues.includes(selectedValue)
      ? selectedValues.filter((item) => item !== selectedValue)
      : [...selectedValues, selectedValue];
    setFieldValue(updatedItems);
  };

  const isInline = useMemo(() => {
    if (['view', 'embedded-view'].includes(sessionMode) || isTrue(field.readonly)) {
      return shouldUseInlineLayout(field.inlineRendering, layoutType, workspaceLayout, sessionMode);
    }
    return false;
  }, [sessionMode, field.readonly, field.inlineRendering, layoutType, workspaceLayout]);

  return sessionMode === 'view' || sessionMode === 'embedded-view' ? (
    <div className={styles.formField}>
      <FieldValueView
        label={t(field.label)}
        value={
          value
            ? (formFieldAdapters[field.type]?.getDisplayValue(field, value) as FormFieldValue | string | undefined)
            : value
        }
        conceptName={field.meta?.concept?.display}
        isInline={isInline}
      />
    </div>
  ) : (
    !field.isHidden && (
      <>
        <div className={styles.boldedLabel}>
          <Layer>
            {isSearchable ? (
              <FilterableMultiSelect
                disabled={field.isDisabled}
                id={field.id}
                selectedItems={selectedQuestionItems}
                invalid={errors.length > 0}
                invalidText={errors[0]?.message}
                items={selectOptions}
                itemToString={(item) => (item ? t(item.label) : ' ')}
                key={field.id}
                onChange={handleSelectItemsChange}
                placeholder={t('search', 'Search') + '...'}
                readOnly={isTrue(field.readonly)}
                titleText={<FieldLabel field={field} />}
                warn={warnings.length > 0}
                warnText={warnings[0]?.message}
              />
            ) : (
              <CheckboxGroup
                legendText={<FieldLabel field={field} />}
                readOnly={isTrue(field.readonly)}
                invalid={errors.length > 0}
                invalidText={<span id={validationMessageId}>{errors[0]?.message}</span>}
                warn={warnings.length > 0}
                warnText={<span id={validationMessageId}>{warnings[0]?.message}</span>}
                aria-describedby={validationDescriptionId}
              >
                {selectOptions?.map((option, index) => {
                  return (
                    <Checkbox
                      aria-describedby={validationDescriptionId}
                      aria-invalid={!isTrue(field.readonly) && errors.length > 0 ? true : undefined}
                      className={styles.checkbox}
                      checked={value?.includes(option.concept) ?? false}
                      disabled={option.disabled}
                      id={`${field.id}-${option.concept}`}
                      key={`${field.id}-${option.concept}-${index}`}
                      labelText={t(option.label)}
                      name={option.concept}
                      onChange={() => handleSelectCheckbox(option)}
                      readOnly={isTrue(field.readonly)}
                    />
                  );
                })}
              </CheckboxGroup>
            )}
          </Layer>
        </div>
        {isSearchable && (
          <div className={styles.selectionDisplay}>
            {value?.length ? (
              <div className={styles.tagContainer}>
                {(formFieldAdapters[field.type]?.getDisplayValue(field, value) as string[] | undefined)?.map(
                  (displayValue, index): React.JSX.Element => (
                    <Tag key={index} type="cool-gray">
                      {t(displayValue)}
                    </Tag>
                  ),
                )}
              </div>
            ) : (
              <ValueEmpty />
            )}
          </div>
        )}
      </>
    )
  );
};

export default MultiSelect;
