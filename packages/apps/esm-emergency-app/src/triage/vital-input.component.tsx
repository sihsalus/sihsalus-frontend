/**
 * Numeric input component for vital signs with clinical interpretation coloring.
 *
 * Renders a Carbon NumberInput that changes background color based on the entered
 * value's clinical interpretation (normal, high, low, critically high/low).
 * Interpretation is computed using patient-specific reference ranges from the backend
 * and fallback ranges from the Zod schema.
 */

import { NumberInput } from '@carbon/react';
import {
  parsePlainDecimalInput,
  preventScientificNotationAndSignKeys,
  preventScientificNotationAndSignPaste,
} from '@openmrs/esm-utils';
import classNames from 'classnames';
import React, { useState } from 'react';
import { type Control, Controller, type FieldErrors, useWatch } from 'react-hook-form';
import { type ConceptReferenceRange } from '../hooks/useConceptReferenceRanges';
import { assessValue, type TriageFormData, type VitalFieldName, vitalSignRanges } from './triage-form.validation';
import styles from './vital-input.component.scss';

/** Props for the VitalInput component. */
interface VitalInputProps {
  fieldName: VitalFieldName;
  label: string;
  control: Control<TriageFormData>;
  errors: FieldErrors<TriageFormData>;
  referenceRange?: ConceptReferenceRange;
  step?: number;
}

const interpretationStyleMap = {
  critically_high: { container: styles.criticalValue, indicator: styles.criticalHighIndicator },
  high: { container: styles.highValue, indicator: styles.highIndicator },
  low: { container: styles.lowValue, indicator: styles.lowIndicator },
  critically_low: { container: styles.criticallyLowValue, indicator: styles.criticalLowIndicator },
  normal: { container: undefined, indicator: undefined },
};

const VitalInput: React.FC<VitalInputProps> = ({ fieldName, label, control, errors, referenceRange, step }) => {
  const systemRange = vitalSignRanges[fieldName];
  const formError = errors[fieldName];
  const [invalid, setInvalid] = useState(false);
  const value = useWatch({ control, name: fieldName });
  const interpretation = assessValue(value, referenceRange);
  const interpretationStyle = interpretationStyleMap[interpretation];

  return (
    <div className={classNames(styles.vitalInputContainer, interpretationStyle.container)}>
      <Controller
        name={fieldName}
        control={control}
        render={({ field }) => (
          <NumberInput
            id={fieldName}
            label={label}
            min={systemRange.min}
            max={systemRange.max}
            step={step}
            type="number"
            allowEmpty
            disableWheel
            value={field.value ?? ''}
            onChange={(_e: unknown, { value: val }: { value: string | number }) => {
              const parsedValue = val === '' ? undefined : parsePlainDecimalInput(val);
              const isValid = val === '' || parsedValue !== undefined;
              setInvalid(!isValid);
              if (isValid) {
                field.onChange(parsedValue);
              }
            }}
            onKeyDown={preventScientificNotationAndSignKeys}
            onPaste={preventScientificNotationAndSignPaste}
            invalid={!!formError || invalid}
            invalidText={formError?.message}
            hideSteppers
          />
        )}
      />
      {interpretation !== 'normal' && value != null && (
        <span className={classNames(styles.interpretationIndicator, interpretationStyle.indicator)} />
      )}
    </div>
  );
};

export default VitalInput;
