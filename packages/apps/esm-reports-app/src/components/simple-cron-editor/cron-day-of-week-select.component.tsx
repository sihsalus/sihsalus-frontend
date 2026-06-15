import { FilterableMultiSelect } from '@carbon/react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type CronField, DAYS_OF_WEEK, DAYS_OF_WEEK_DEFAULT_LABELS } from './commons';

interface CronDayOfWeekSelectProps {
  value: CronField[];
  onChange: (selectedDaysOfWeek: CronField[]) => void;
}

interface ValidationState {
  invalid: boolean;
  invalidText: string;
}

const CronDayOfWeekSelect: React.FC<CronDayOfWeekSelectProps> = ({ value, onChange }) => {
  const { t } = useTranslation();

  const [valueInternal, setValueInternal] = useState<CronField[]>(value);
  const [validationState, setValidationState] = useState<ValidationState>({
    invalid: false,
    invalidText: null,
  });

  const validate = useCallback(() => {
    if (!!valueInternal && valueInternal.length > 0) {
      setValidationState({ invalid: false, invalidText: null });
      onChange(valueInternal);
    } else {
      setValidationState({ invalid: true, invalidText: t('dayOfWeekRequired', 'Required') });
      onChange(null);
    }
  }, [t, valueInternal, onChange]);

  useEffect(() => {
    setValueInternal(value);
  }, [value]);

  useEffect(() => {
    validate();
  }, [validate]);

  return (
    <FilterableMultiSelect
      id="dayOfWeek"
      hideLabel
      selectedItems={valueInternal ? valueInternal : []}
      invalid={validationState.invalid}
      invalidText={t(validationState.invalidText)}
      items={DAYS_OF_WEEK}
      itemToString={(item) =>
        item ? t('dayOfWeek_' + item.name, DAYS_OF_WEEK_DEFAULT_LABELS[item.name] || item.name) : ''
      }
      sortItems={(items: Array<CronField & { isSelectAll?: boolean }>, { selectedItems }) => {
        return items.slice(0).sort((item1, item2) => {
          // Always place "select all" option at the beginning
          if (item1.isSelectAll) return -1;
          if (item2.isSelectAll) return 1;
          const hasItem1 = selectedItems.includes(item1);
          const hasItem2 = selectedItems.includes(item2);
          if (hasItem1 && !hasItem2) return -1;
          if (hasItem2 && !hasItem1) return 1;

          if (typeof item1.value === 'number' && typeof item2.value === 'number') {
            return item1.value - item2.value;
          } else if (typeof item1.value === 'string' && typeof item2.value === 'string') {
            return item1.value.localeCompare(item2.value);
          } else if (typeof item1.value === 'number' && typeof item2.value === 'string') {
            return -1;
          } else if (typeof item1.value === 'string' && typeof item2.value === 'number') {
            return 1;
          } else {
            return 0;
          }
        });
      }}
      onChange={(event) => setValueInternal(event.selectedItems)}
      selectionFeedback="fixed"
    />
  );
};

export default CronDayOfWeekSelect;
