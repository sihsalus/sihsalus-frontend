import { Dropdown, NumberInput } from '@carbon/react';
import {
  shouldPreventPlainNumberKey,
  shouldPreventPlainNumberPaste,
  validatePlainNumberInput,
} from '@openmrs/esm-utils';
import React, { useCallback, useMemo } from 'react';
import { type Control, useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { type ImmunizationSequenceDefinition } from '../../types/fhir-immunization-domain';
import styles from './../immunizations-form.scss';

const doseNumberConstraints = { integer: true, min: 1, nonNegative: true };

export const DoseInput: React.FC<{
  vaccine: string;
  sequences: ImmunizationSequenceDefinition[];
  control: Control;
  existingDoseNumbers?: number[];
  warningMessage?: string;
}> = ({ vaccine, sequences, control, existingDoseNumbers = [], warningMessage }) => {
  const { t } = useTranslation();
  const { field, fieldState } = useController({ name: 'doseNumber', control });
  const showWarning = !!warningMessage && !fieldState.error;

  const vaccineSequences = useMemo(
    () => sequences?.find((sequence) => sequence.vaccineConceptUuid === vaccine)?.sequences || [],
    [sequences, vaccine],
  );

  const availableSequences = useMemo(
    () => vaccineSequences.filter((sequence) => !existingDoseNumbers.includes(sequence.sequenceNumber)),
    [existingDoseNumbers, vaccineSequences],
  );

  const handleChange = useCallback(
    (_event, { value }) => {
      const parsedValue = validatePlainNumberInput(value ?? '', doseNumberConstraints).parsedValue;
      field.onChange(parsedValue);
    },
    [field],
  );

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (shouldPreventPlainNumberKey(event.key, doseNumberConstraints)) {
      event.preventDefault();
    }
  }, []);

  const handlePaste = useCallback((event: React.ClipboardEvent<HTMLInputElement>) => {
    if (shouldPreventPlainNumberPaste(event.clipboardData.getData('text'), doseNumberConstraints)) {
      event.preventDefault();
    }
  }, []);

  return (
    <div className={styles.row}>
      {vaccineSequences.length ? (
        availableSequences.length === 0 ? (
          <p>{t('allDosesAdministered', 'All doses for this vaccine have already been recorded')}</p>
        ) : (
          <Dropdown
            id="sequence"
            invalid={!!fieldState.error}
            invalidText={fieldState.error?.message}
            items={availableSequences.map((sequence) => sequence.sequenceNumber)}
            itemToString={(item) =>
              availableSequences.find((sequence) => sequence.sequenceNumber === item)?.sequenceLabel
            }
            label={t('pleaseSelect', 'Please select')}
            onChange={(val) => field.onChange(parseInt(String(val.selectedItem || 0), 10))}
            selectedItem={field.value}
            titleText={t('sequence', 'Sequence')}
            warn={showWarning}
            warnText={warningMessage}
          />
        )
      ) : (
        <NumberInput
          allowEmpty
          disableWheel
          hideSteppers
          id="doseNumber"
          invalid={!!fieldState.error}
          invalidText={fieldState.error?.message}
          label={t('doseNumberWithinSeries', 'Dose number within series')}
          min={1}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          required
          value={field.value}
          warn={showWarning}
          warnText={warningMessage}
        />
      )}
    </div>
  );
};
