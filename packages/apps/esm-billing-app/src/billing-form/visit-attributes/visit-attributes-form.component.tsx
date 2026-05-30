import { ComboBox, InlineLoading, RadioButton, RadioButtonGroup, Stack } from '@carbon/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useConfig } from '@openmrs/esm-framework';
import React, { useCallback, useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { usePaymentMethods } from '../billing-form.resource';
import styles from './visit-attributes-form.scss';

type VisitAttributesFormProps = {
  setAttributes: (state) => void;
  setPaymentMethod?: (value: any) => void;
};

type VisitAttributesFormValue = {
  paymentDetails: string;
  paymentMethods: string;
  patientCategory: string;
};

const visitAttributesFormSchema = z.object({
  paymentDetails: z.string(),
  paymentMethods: z.string(),
  patientCategory: z.string(),
});

const VisitAttributesForm: React.FC<VisitAttributesFormProps> = ({ setAttributes, setPaymentMethod }) => {
  const { t } = useTranslation();
  const { patientCategory, categoryConcepts, nonPayingPatientCategories } = useConfig();
  const { control, getValues, watch } = useForm<VisitAttributesFormValue>({
    mode: 'all',
    defaultValues: {},
    resolver: zodResolver(visitAttributesFormSchema),
  });

  const [paymentDetails] = watch(['paymentDetails']);

  const { paymentModes, isLoading: isLoadingPaymentModes } = usePaymentMethods();
  const patientCategoryOptions = useMemo(() => {
    return Object.entries(nonPayingPatientCategories ?? {}).map(([key, uuid]) => ({
      // t('childUnder5', 'Child under 5')
      // t('student', 'Student')
      text: t(key),
      uuid,
    }));
  }, [nonPayingPatientCategories, t]);

  const createVisitAttributesPayload = useCallback(() => {
    const { paymentDetails, paymentMethods, patientCategory: patientCategoryValue } = getValues();
    setPaymentMethod?.(paymentMethods);

    const formPayload = [
      { uuid: patientCategory.paymentDetails, value: paymentDetails },
      { uuid: patientCategory.paymentMethods, value: paymentMethods },
      { uuid: patientCategory.patientCategory, value: patientCategoryValue },
    ];

    const visitAttributesPayload = formPayload.filter(
      (item) => item.value !== undefined && item.value !== null && item.value !== '',
    );
    return Object.entries(visitAttributesPayload).map(([_key, value]) => ({
      attributeType: value.uuid,
      value: value.value,
    }));
  }, [
    getValues,
    patientCategory.patientCategory,
    patientCategory.paymentDetails,
    patientCategory.paymentMethods,
    setPaymentMethod,
  ]);

  useEffect(() => {
    setAttributes(createVisitAttributesPayload());

    const subscription = watch(() => {
      setAttributes(createVisitAttributesPayload());
    });

    return () => subscription.unsubscribe();
  }, [createVisitAttributesPayload, setAttributes, watch]);

  if (isLoadingPaymentModes) {
    return (
      <InlineLoading
        status="active"
        iconDescription={t('loadingDescription', 'Loading')}
        description={t('loading', 'Loading data') + '...'}
      />
    );
  }

  return (
    <Stack className={styles.stack} gap={5}>
      <Controller
        name="paymentDetails"
        control={control}
        render={({ field }) => (
          <RadioButtonGroup
            className={styles.radioButtonGroup}
            legendText={t('paymentDetails', 'Payment details')}
            name="payment-details"
            onChange={(selected) => field.onChange(selected)}
            orientation="vertical"
          >
            <RadioButton labelText={t('paying', 'Paying')} value={categoryConcepts.payingDetails} id="radio-1" />
            <RadioButton
              labelText={t('nonPaying', 'Non paying')}
              value={categoryConcepts.nonPayingDetails}
              id="radio-2"
            />
          </RadioButtonGroup>
        )}
      />
      {paymentDetails === categoryConcepts.payingDetails && (
        <Controller
          control={control}
          name="paymentMethods"
          render={({ field }) => (
            <ComboBox
              id="paymentMethods"
              items={paymentModes}
              itemToString={(item) => (item ? item.name : '')}
              onChange={({ selectedItem }) => field.onChange(selectedItem?.uuid)}
              placeholder={t('selectPaymentMethod', 'Select payment method')}
              titleText={t('paymentMethod', 'Payment method')}
            />
          )}
        />
      )}
      {paymentDetails === categoryConcepts.nonPayingDetails && (
        <Controller
          control={control}
          name="patientCategory"
          render={({ field }) => (
            <ComboBox
              className={styles.sectionField}
              onChange={({ selectedItem }) => field.onChange(selectedItem?.uuid)}
              id="patientCategory"
              items={patientCategoryOptions}
              itemToString={(item) => (item ? item.text : '')}
              titleText={t('patientCategory', 'Patient category')}
              placeholder={t('selectPatientCategory', 'Select patient category')}
            />
          )}
        />
      )}
    </Stack>
  );
};

export default VisitAttributesForm;
