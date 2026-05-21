import {
  Button,
  ButtonSet,
  Column,
  Dropdown,
  Form,
  Layer,
  NumberInput,
  RadioButton,
  RadioButtonGroup,
  Stack,
  Toggle,
} from '@carbon/react';
import { type DefaultWorkspaceProps, OpenmrsDatePicker, useLayoutType, useVisitTypes } from '@openmrs/esm-framework';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './queue-linelist-filter.scss';

const QueueLinelistFilter: React.FC<DefaultWorkspaceProps> = ({ closeWorkspace }) => {
  const { t } = useTranslation();
  const allVisitTypes = useVisitTypes();
  const isTablet = useLayoutType() === 'tablet';

  const [endAge, setEndAge] = useState<number | ''>('');
  const [, setGender] = useState('');
  const [returnDate, setReturnDate] = useState(new Date());
  const [startAge, setStartAge] = useState<number | ''>('');
  const [, setVisitType] = useState('');

  const handleFilter = (event) => {
    event.preventDefault();
  };

  const handleTodaysDate = () => {
    setReturnDate(new Date());
  };

  const handleStartAgeChange = (event) => {
    setStartAge(event.currentTarget.value === '' ? '' : Number(event.currentTarget.value));
  };

  const handleEndAgeChange = (event) => {
    setEndAge(event.currentTarget.value === '' ? '' : Number(event.currentTarget.value));
  };

  return (
    <>
      <Form onSubmit={handleFilter}>
        <div className={styles.wrapper}>
          <Stack gap={4} className={styles.grid}>
            <Column>
              <p className={styles.heading}> {t('gender', 'Gender')}</p>
              <RadioButtonGroup name="gender" orientation="vertical" onChange={(event) => setGender(event.toString())}>
                <RadioButton
                  className={styles.radioButton}
                  id="male"
                  labelText={t('maleLabelText', 'Male')}
                  value="Male"
                />
                <RadioButton
                  className={styles.radioButton}
                  id="female"
                  labelText={t('femaleLabelText', 'Female')}
                  value="Female"
                />
              </RadioButtonGroup>
            </Column>
          </Stack>

          <Stack gap={4} className={styles.grid}>
            <Column md={2}>
              <p className={styles.heading}> {t('age', 'Age')}</p>
              <Layer>
                <Toggle
                  size="sm"
                  aria-label={t('age', 'Age')}
                  defaultToggled
                  id="age"
                  labelA="Off"
                  labelB="On"
                  labelText=""
                />
              </Layer>
              <Layer className={styles.numberInputs}>
                <Layer>
                  <NumberInput
                    id="startAge"
                    invalidText={t('startAgeRangeInvalid', 'Start age range is not valid')}
                    label={t('between', 'Between')}
                    max={100}
                    min={0}
                    onChange={handleStartAgeChange}
                    size="md"
                    value={startAge}
                  />
                </Layer>
                <Layer>
                  <NumberInput
                    id="endAge"
                    invalidText={t('endAgeRangeInvalid', 'End age range is not valid')}
                    label={t('and', 'And')}
                    max={100}
                    min={0}
                    onChange={handleEndAgeChange}
                    size="md"
                    value={endAge}
                  />
                </Layer>
              </Layer>
            </Column>
          </Stack>

          <Stack gap={4} className={styles.grid}>
            <Column md={2}>
              <p className={styles.heading}> {t('returnDate', 'Return Date')}</p>
              <Layer>
                <OpenmrsDatePicker
                  value={returnDate}
                  onChange={setReturnDate}
                  id="returnDate"
                  data-testid="returnDate"
                  labelText={t('date', 'Date')}
                />
              </Layer>
              <Button
                kind="ghost"
                onClick={() => {
                  handleTodaysDate();
                }}
              >
                {t('useTodaysDate', "Use today's date")}
              </Button>
            </Column>
          </Stack>

          <Stack gap={4} className={styles.grid}>
            <Column>
              <p className={styles.heading}>{t('visitType', 'Visit Type')}</p>
              <Layer>
                <Dropdown
                  id="visitType"
                  label={t('selectAVisitType', 'Select visit type')}
                  titleText={t('selectAVisitType', 'Select visit type')}
                  items={allVisitTypes}
                  onChange={(event) => setVisitType(event.selectedItem.toString)}
                  size="sm"
                  itemToElement={(item) => (item ? <span>{item.display}</span> : null)}
                />
              </Layer>
            </Column>
          </Stack>
        </div>

        <ButtonSet className={isTablet ? styles.tablet : styles.desktop}>
          <Button className={styles.button} kind="secondary" onClick={() => closeWorkspace()}>
            {t('cancel', 'Cancel')}
          </Button>
          <Button className={styles.button} kind="primary" type="submit">
            {t('applyFilters', 'Apply filters')}
          </Button>
        </ButtonSet>
      </Form>
    </>
  );
};

export default QueueLinelistFilter;
