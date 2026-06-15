import { ContentSwitcher, Layer, Switch, TextInput } from '@carbon/react';
import { OpenmrsDatePicker, useConfig } from '@openmrs/esm-framework';
import {
  shouldPreventPlainNumberKey,
  shouldPreventPlainNumberPaste,
  validatePlainNumberInput,
} from '@openmrs/esm-utils';
import { useField } from 'formik';
import React, { type ChangeEvent, useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';

import { type RegistrationConfig } from '../../../config-schema';
import { moduleName } from '../../../constants';
import { PatientRegistrationContext } from '../../patient-registration-context';
import styles from '../field.scss';

const calcBirthdate = (yearDelta, monthDelta, dateOfBirth) => {
  const { enabled, month, dayOfMonth } = dateOfBirth.useEstimatedDateOfBirth;
  const startDate = new Date();
  const resultMonth = new Date(startDate.getFullYear() - yearDelta, startDate.getMonth() - monthDelta, 1);
  const daysInResultMonth = new Date(resultMonth.getFullYear(), resultMonth.getMonth() + 1, 0).getDate();
  const resultDate = new Date(
    resultMonth.getFullYear(),
    resultMonth.getMonth(),
    Math.min(startDate.getDate(), daysInResultMonth),
  );
  return enabled ? new Date(resultDate.getFullYear(), month, dayOfMonth) : resultDate;
};

const estimatedYearsConstraints = { integer: true, max: 139, min: 0, nonNegative: true };
const estimatedMonthsConstraints = { integer: true, min: 0, nonNegative: true };

const preventInvalidEstimatedAgeKey =
  (constraints: typeof estimatedYearsConstraints | typeof estimatedMonthsConstraints) =>
  (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (shouldPreventPlainNumberKey(event.key, constraints)) {
      event.preventDefault();
    }
  };

const preventInvalidEstimatedAgePaste =
  (constraints: typeof estimatedYearsConstraints | typeof estimatedMonthsConstraints) =>
  (event: React.ClipboardEvent<HTMLInputElement>) => {
    if (shouldPreventPlainNumberPaste(event.clipboardData.getData('text'), constraints)) {
      event.preventDefault();
    }
  };

export const DobField: React.FC = () => {
  const { t } = useTranslation(moduleName);
  const {
    fieldConfigurations: { dateOfBirth },
  } = useConfig<RegistrationConfig>();
  const allowEstimatedBirthDate = dateOfBirth?.allowEstimatedDateOfBirth;
  const [{ value: dobUnknown }] = useField('birthdateEstimated');
  const [birthdate, birthdateMeta] = useField('birthdate');
  const [yearsEstimated, yearsEstimateMeta] = useField('yearsEstimated');
  const [monthsEstimated, monthsEstimateMeta] = useField('monthsEstimated');
  const { setFieldValue, setFieldTouched } = useContext(PatientRegistrationContext);
  const today = new Date();

  const onToggle = useCallback(
    (e: { name?: string | number }) => {
      setFieldValue('birthdateEstimated', e.name === 'unknown');
      setFieldValue('birthdate', '');
      setFieldValue('yearsEstimated', 0);
      setFieldValue('monthsEstimated', '');
      setFieldTouched('birthdateEstimated', true, false);
    },
    [setFieldTouched, setFieldValue],
  );

  const onDateChange = useCallback(
    (birthdate: Date) => {
      setFieldValue('birthdate', birthdate);
      setFieldTouched('birthdate', true, false);
    },
    [setFieldValue, setFieldTouched],
  );

  const onEstimatedYearsChange = useCallback(
    (ev: ChangeEvent<HTMLInputElement>) => {
      if (!ev.target.value.trim()) {
        setFieldValue('yearsEstimated', '');
        return;
      }

      const years = validatePlainNumberInput(ev.target.value, estimatedYearsConstraints).parsedValue;

      if (years != null) {
        setFieldValue('yearsEstimated', years);
        setFieldValue('birthdate', calcBirthdate(years, monthsEstimateMeta.value, dateOfBirth));
      }
    },
    [setFieldValue, dateOfBirth, monthsEstimateMeta.value],
  );

  const onEstimatedMonthsChange = useCallback(
    (ev: ChangeEvent<HTMLInputElement>) => {
      if (!ev.target.value.trim()) {
        setFieldValue('monthsEstimated', '');
        return;
      }

      const months = validatePlainNumberInput(ev.target.value, estimatedMonthsConstraints).parsedValue;

      if (months != null) {
        setFieldValue('monthsEstimated', months);
        setFieldValue('birthdate', calcBirthdate(yearsEstimateMeta.value, months, dateOfBirth));
      }
    },
    [setFieldValue, dateOfBirth, yearsEstimateMeta.value],
  );

  const updateBirthdate = useCallback(() => {
    const months = +monthsEstimateMeta.value % 12;
    const years = +yearsEstimateMeta.value + Math.floor(monthsEstimateMeta.value / 12);
    setFieldValue('yearsEstimated', years);
    setFieldValue('monthsEstimated', months > 0 ? months : '');
    setFieldValue('birthdate', calcBirthdate(years, months, dateOfBirth));
    setFieldTouched('yearsEstimated', true, false);
    setFieldTouched('monthsEstimated', true, false);
    setFieldTouched('birthdate', true, false);
  }, [setFieldValue, setFieldTouched, monthsEstimateMeta, yearsEstimateMeta, dateOfBirth]);

  return (
    <div className={styles.halfWidthInDesktopView}>
      <h4 className={`${styles.productiveHeading02Light} ${styles.requiredHeading}`}>
        {t('birthFieldLabelText', 'Birth')}
      </h4>
      {(allowEstimatedBirthDate || dobUnknown) && (
        <div className={styles.dobField}>
          <div className={styles.dobContentSwitcherLabel}>
            <span className={styles.label01}>{t('dobToggleLabelText', 'Date of birth known?')}</span>
          </div>
          <ContentSwitcher onChange={onToggle} selectedIndex={dobUnknown ? 1 : 0}>
            <Switch name="known" text={t('yes', 'Yes')} />
            <Switch name="unknown" text={t('no', 'No')} />
          </ContentSwitcher>
        </div>
      )}
      <Layer>
        {!dobUnknown ? (
          <div className={styles.dobField}>
            <OpenmrsDatePicker
              id="birthdate"
              data-testid="birthdate"
              {...birthdate}
              onChange={onDateChange}
              onBlur={() => setFieldTouched('birthdate', true, false)}
              maxDate={today}
              isRequired
              labelText={t('dateOfBirthLabelText', 'Date of birth')}
              isInvalid={!!(birthdateMeta.touched && birthdateMeta.error)}
              invalidText={t(birthdateMeta.error)}
              value={birthdate.value}
            />
          </div>
        ) : (
          <div className={styles.grid}>
            <div className={styles.dobField}>
              <TextInput
                {...yearsEstimated}
                id="yearsEstimated"
                type="number"
                name={yearsEstimated.name}
                onChange={onEstimatedYearsChange}
                onKeyDown={preventInvalidEstimatedAgeKey(estimatedYearsConstraints)}
                onPaste={preventInvalidEstimatedAgePaste(estimatedYearsConstraints)}
                labelText={t('estimatedAgeInYearsLabelText', 'Estimated age in years')}
                invalid={!!(yearsEstimateMeta.touched && yearsEstimateMeta.error)}
                invalidText={yearsEstimateMeta.error && t(yearsEstimateMeta.error)}
                value={yearsEstimated.value}
                min={0}
                required
                onBlur={(e) => {
                  yearsEstimated.onBlur(e);
                  setFieldTouched('yearsEstimated', true, false);
                  updateBirthdate();
                }}
              />
            </div>
            <div className={styles.dobField}>
              <TextInput
                {...monthsEstimated}
                id="monthsEstimated"
                type="number"
                name={monthsEstimated.name}
                onChange={onEstimatedMonthsChange}
                onKeyDown={preventInvalidEstimatedAgeKey(estimatedMonthsConstraints)}
                onPaste={preventInvalidEstimatedAgePaste(estimatedMonthsConstraints)}
                labelText={t('estimatedAgeInMonthsLabelText', 'Estimated age in months')}
                invalid={!!(monthsEstimateMeta.touched && monthsEstimateMeta.error)}
                invalidText={monthsEstimateMeta.error && t(monthsEstimateMeta.error)}
                value={monthsEstimated.value}
                min={0}
                required={!yearsEstimateMeta.value}
                onBlur={(e) => {
                  monthsEstimated.onBlur(e);
                  setFieldTouched('monthsEstimated', true, false);
                  updateBirthdate();
                }}
              />
            </div>
          </div>
        )}
      </Layer>
    </div>
  );
};
