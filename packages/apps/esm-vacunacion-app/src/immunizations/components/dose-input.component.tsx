import { Dropdown, NumberInput } from '@carbon/react';
import React, { useCallback, useMemo } from 'react';
import { type Control, useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { type ImmunizationSequenceDefinition } from '../../types/fhir-immunization-domain';
import styles from './../immunizations-form.scss';

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
      const parsedValue =
        value === '' || value === null || (typeof value === 'string' && !value.trim()) ? undefined : Number(value);
      field.onChange(Number.isNaN(parsedValue) ? undefined : parsedValue);
    },
    [field],
  );

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
          required
          value={field.value}
          warn={showWarning}
          warnText={warningMessage}
        />
      )}
    </div>
  );
};
