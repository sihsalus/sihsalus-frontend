import {
  Button,
  ButtonSet,
  Column,
  DatePicker,
  DatePickerInput,
  Layer,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Stack,
  TextInput,
} from '@carbon/react';
import {
  shouldPreventPlainNumberKey,
  shouldPreventPlainNumberPaste,
  validatePlainNumberInput,
} from '@openmrs/esm-utils';
import React, { type ClipboardEvent, type KeyboardEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './relationship-modal.scss';

const ageConstraints = { integer: true, min: 5, nonNegative: true };

function preventInvalidAgeKey(event: KeyboardEvent<HTMLInputElement>) {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }

  if (shouldPreventPlainNumberKey(event.key, ageConstraints)) {
    event.preventDefault();
  }
}

function preventInvalidAgePaste(event: ClipboardEvent<HTMLInputElement>) {
  if (shouldPreventPlainNumberPaste(event.clipboardData.getData('text'), ageConstraints)) {
    event.preventDefault();
  }
}

interface BirthDateCalculatorProps {
  onClose: () => void;
  props: {
    date: Date;
    onBirthDateChange: (date: Date) => void;
  };
}

const BirthDateCalculator: React.FC<BirthDateCalculatorProps> = ({ onClose, props: { date, onBirthDateChange } }) => {
  const { t } = useTranslation();
  const [formState, setFormState] = useState<{ fromDate: Date; age: number | undefined }>({
    fromDate: date ?? new Date(),
    age: undefined,
  });

  const handleSubmit = () => {
    const { fromDate, age } = formState;
    if (!age) {
      return;
    }

    // Create a new date object to avoid mutating state directly
    const dob = new Date(fromDate);

    // Subtract the age from the current year
    dob.setFullYear(dob.getFullYear() - age);

    // Update the state and close the modal
    onBirthDateChange(dob);
    onClose();
  };

  return (
    <React.Fragment>
      <ModalHeader closeModal={onClose} className={styles.heading}>
        {t('calculateBirthDate', 'Calculate birth date')}
      </ModalHeader>
      <ModalBody>
        <Stack style={{ gap: '10px' }}>
          <Column>
            <Layer>
              <TextInput
                id="birthdate-calculator-age"
                placeholder="age"
                labelText={t('age', 'Age')}
                type="number"
                min={5}
                value={formState.age}
                onChange={(e) => {
                  const validation = validatePlainNumberInput(e.target.value, ageConstraints);
                  setFormState({
                    ...formState,
                    age: validation.parsedValue,
                  });
                }}
                onKeyDown={preventInvalidAgeKey}
                onPaste={preventInvalidAgePaste}
              />
            </Layer>
          </Column>
          <Column>
            <Layer>
              <DatePicker
                datePickerType="single"
                value={formState.fromDate}
                onChange={([date]) => setFormState({ ...formState, fromDate: date })}
              >
                <DatePickerInput
                  id="birthdate-calculator-date"
                  placeholder="mm/dd/yyyy"
                  labelText={t('onDate', 'On Date')}
                  size="lg"
                />
              </DatePicker>
            </Layer>
          </Column>
        </Stack>
      </ModalBody>
      <ModalFooter>
        <ButtonSet className={styles.buttonSet}>
          <Button
            className={styles.button}
            kind="primary"
            onClick={handleSubmit}
            disabled={!formState.age || !formState.fromDate}
          >
            Submit
          </Button>
          <Button className={styles.button} kind="secondary" onClick={onClose}>
            Cancel
          </Button>
        </ButtonSet>
      </ModalFooter>
    </React.Fragment>
  );
};

export default BirthDateCalculator;
