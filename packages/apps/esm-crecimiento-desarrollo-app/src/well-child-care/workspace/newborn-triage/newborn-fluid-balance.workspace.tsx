import {
  Button,
  ButtonSet,
  ButtonSkeleton,
  Column,
  Form,
  InlineNotification,
  NumberInputSkeleton,
  Row,
  Stack,
} from '@carbon/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { createErrorHandler, showSnackbar, useConfig, useLayoutType, useSession } from '@openmrs/esm-framework';
import React, { useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import type { ConfigObject } from '../../../config-schema';
import type { DefaultPatientWorkspaceProps } from '../../../types';
import { invalidateCachedVitalsAndBiometrics, saveVitalsAndBiometrics, useVitalsConceptMetadata } from '../../common';

import styles from './newborn-vitals-form.scss';
import NewbornVitalsInput from './newborn-vitals-input.component';
import { isValueWithinReferenceRange } from './vitals-biometrics-form.utils';

const FluidBalanceSchema = z
  .object({
    stoolCount: z.number(),
    stoolGrams: z.number(),
    urineCount: z.number(),
    urineGrams: z.number(),
    vomitCount: z.number(),
    vomitGramsML: z.number(),
  })
  .partial()
  .refine((fields) => Object.values(fields).some((value) => value != null), {
    message: 'Please fill at least one field',
    path: ['oneFieldRequired'],
  });

export type FluidBalanceFormType = z.infer<typeof FluidBalanceSchema>;

type FluidBalanceFieldId = keyof FluidBalanceFormType;

type FluidBalanceFieldConfig = {
  conceptUuid: string;
  id: FluidBalanceFieldId;
  label: string;
  max: number;
  min: number;
  unitSymbol: string;
};

const defaultFluidBalanceRange = {
  min: 0,
  max: 20,
};

const NewbornFluidBalanceForm: React.FC<DefaultPatientWorkspaceProps> = ({ closeWorkspace, workspaceProps }) => {
  const patientUuid = workspaceProps?.patientUuid ?? '';
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const config = useConfig<ConfigObject>();
  const session = useSession();
  const { data: conceptUnits, conceptMetadata, conceptRanges, isLoading } = useVitalsConceptMetadata();
  const [showErrorNotification, setShowErrorNotification] = useState(false);
  const [showErrorMessage, setShowErrorMessage] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    formState: { isSubmitting },
  } = useForm<FluidBalanceFormType>({
    mode: 'all',
    resolver: zodResolver(FluidBalanceSchema),
  });

  const currentValues = watch();

  const getConfiguredRange = useCallback(
    (conceptUuid: string) => {
      const range = conceptRanges.get(conceptUuid);
      return {
        min: range?.lowAbsolute ?? defaultFluidBalanceRange.min,
        max: range?.highAbsolute ?? defaultFluidBalanceRange.max,
      };
    },
    [conceptRanges],
  );

  const fluidBalanceFields = useMemo<Array<FluidBalanceFieldConfig>>(
    () => [
      {
        id: 'stoolCount',
        label: t('stoolCount', 'Stool Count'),
        conceptUuid: config.concepts.stoolCountUuid,
        unitSymbol: conceptUnits.get(config.concepts.stoolCountUuid) ?? '',
        ...getConfiguredRange(config.concepts.stoolCountUuid),
      },
      {
        id: 'stoolGrams',
        label: t('stoolGrams', 'Stool Weight (g)'),
        conceptUuid: config.concepts.stoolGramsUuid,
        unitSymbol: conceptUnits.get(config.concepts.stoolGramsUuid) ?? 'g',
        ...getConfiguredRange(config.concepts.stoolGramsUuid),
      },
      {
        id: 'urineCount',
        label: t('urineCount', 'Urine Count'),
        conceptUuid: config.concepts.urineCountUuid,
        unitSymbol: conceptUnits.get(config.concepts.urineCountUuid) ?? '',
        ...getConfiguredRange(config.concepts.urineCountUuid),
      },
      {
        id: 'urineGrams',
        label: t('urineGrams', 'Urine Volume (g/mL)'),
        conceptUuid: config.concepts.urineGramsUuid,
        unitSymbol: conceptUnits.get(config.concepts.urineGramsUuid) ?? 'g/mL',
        ...getConfiguredRange(config.concepts.urineGramsUuid),
      },
      {
        id: 'vomitCount',
        label: t('vomitCount', 'Vomit Count'),
        conceptUuid: config.concepts.vomitCountUuid,
        unitSymbol: conceptUnits.get(config.concepts.vomitCountUuid) ?? '',
        ...getConfiguredRange(config.concepts.vomitCountUuid),
      },
      {
        id: 'vomitGramsML',
        label: t('vomitGramsML', 'Vomit Volume (g/mL)'),
        conceptUuid: config.concepts.vomitGramsMLUuid,
        unitSymbol: conceptUnits.get(config.concepts.vomitGramsMLUuid) ?? 'g/mL',
        ...getConfiguredRange(config.concepts.vomitGramsMLUuid),
      },
    ],
    [
      conceptUnits,
      config.concepts.stoolCountUuid,
      config.concepts.stoolGramsUuid,
      config.concepts.urineCountUuid,
      config.concepts.urineGramsUuid,
      config.concepts.vomitCountUuid,
      config.concepts.vomitGramsMLUuid,
      getConfiguredRange,
      t,
    ],
  );

  const fluidBalanceFieldsById = useMemo(
    () => new Map(fluidBalanceFields.map((field) => [field.id, field])),
    [fluidBalanceFields],
  );

  const isValueWithinConfiguredRange = useCallback(
    (fieldId: FluidBalanceFieldId, value?: number) => {
      if (value == null) {
        return true;
      }

      const field = fluidBalanceFieldsById.get(fieldId);
      return Boolean(
        field &&
          value >= field.min &&
          value <= field.max &&
          isValueWithinReferenceRange(conceptMetadata, field.conceptUuid, value),
      );
    },
    [conceptMetadata, fluidBalanceFieldsById],
  );

  const saveFluidBalance = useCallback(
    (data: FluidBalanceFormType) => {
      setShowErrorMessage(true);
      setShowErrorNotification(false);

      const allFieldsAreValid = Object.entries(data)
        .filter(([, value]) => value != null)
        .every(([key, value]) => isValueWithinConfiguredRange(key as FluidBalanceFieldId, value));

      if (allFieldsAreValid) {
        setShowErrorMessage(false);
        const abortController = new AbortController();

        saveVitalsAndBiometrics(
          config.vitals.encounterTypeUuid,
          config.vitals.formUuid,
          config.concepts,
          patientUuid,
          data,
          abortController,
          session?.sessionLocation?.uuid,
        )
          .then((response) => {
            if (response.status === 201) {
              invalidateCachedVitalsAndBiometrics();
              closeWorkspace({ discardUnsavedChanges: true });
              showSnackbar({
                isLowContrast: true,
                kind: 'success',
                title: t('fluidBalanceRecorded', 'Balance de líquidos registrado'),
                subtitle: t('fluidBalanceNowAvailable', 'Ahora visible en la página de balance de líquidos'),
              });
            }
          })
          .catch(() => {
            createErrorHandler();
            showSnackbar({
              title: t('fluidBalanceSaveError', 'Error guardando el balance de líquidos'),
              kind: 'error',
              isLowContrast: false,
              subtitle: t('checkForValidity', 'Some of the values entered may be invalid'),
            });
          })
          .finally(() => abortController.abort());
      } else {
        setShowErrorMessage(true);
      }
    },
    [
      closeWorkspace,
      config.concepts,
      config.vitals.encounterTypeUuid,
      config.vitals.formUuid,
      isValueWithinConfiguredRange,
      patientUuid,
      session?.sessionLocation?.uuid,
      t,
    ],
  );

  function onError(err) {
    if (err?.oneFieldRequired) {
      setShowErrorNotification(true);
    }
  }

  if (isLoading) {
    return (
      <Form className={styles.form}>
        <div className={styles.grid}>
          <Stack>
            <Column>
              <p className={styles.title}>{t('recordFluidBalance', 'Registrar balance de líquidos')}</p>
            </Column>
            <Row className={styles.row}>
              <Column>
                <NumberInputSkeleton />
              </Column>
              <Column>
                <NumberInputSkeleton />
              </Column>
              <Column>
                <NumberInputSkeleton />
              </Column>
              <Column>
                <NumberInputSkeleton />
              </Column>
            </Row>
          </Stack>
        </div>
        <ButtonSet className={isTablet ? styles.tablet : styles.desktop}>
          <ButtonSkeleton className={styles.button} />
          <ButtonSkeleton className={styles.button} />
        </ButtonSet>
      </Form>
    );
  }

  return (
    <Form className={styles.form} onSubmit={handleSubmit(saveFluidBalance, onError)}>
      <div className={styles.grid}>
        <Stack gap={4}>
          <Column>
            <p className={styles.title}>{t('fluidBalance', 'Balance de líquidos')}</p>
          </Column>
          <Row className={styles.row}>
            {fluidBalanceFields.slice(0, 4).map((field) => (
              <NewbornVitalsInput
                key={field.id}
                control={control}
                label={field.label}
                fieldProperties={[
                  {
                    id: field.id,
                    name: field.label,
                    type: 'number',
                    min: field.min,
                    max: field.max,
                    invalidText: t('fieldRangeValidationInputError', '{{field}} debe estar entre {{min}} y {{max}}', {
                      field: field.label,
                      min: field.min,
                      max: field.max,
                    }),
                  },
                ]}
                isValueWithinReferenceRange={isValueWithinConfiguredRange(field.id, currentValues[field.id])}
                showErrorMessage={showErrorMessage}
                showInlineValidation
                unitSymbol={field.unitSymbol}
              />
            ))}
          </Row>
          <Row className={styles.row}>
            {fluidBalanceFields.slice(4).map((field) => (
              <NewbornVitalsInput
                key={field.id}
                control={control}
                label={field.label}
                fieldProperties={[
                  {
                    id: field.id,
                    name: field.label,
                    type: 'number',
                    min: field.min,
                    max: field.max,
                    invalidText: t('fieldRangeValidationInputError', '{{field}} debe estar entre {{min}} y {{max}}', {
                      field: field.label,
                      min: field.min,
                      max: field.max,
                    }),
                  },
                ]}
                isValueWithinReferenceRange={isValueWithinConfiguredRange(field.id, currentValues[field.id])}
                showErrorMessage={showErrorMessage}
                showInlineValidation
                unitSymbol={field.unitSymbol}
              />
            ))}
          </Row>
        </Stack>
      </div>
      {showErrorNotification && (
        <Column className={styles.errorContainer}>
          <InlineNotification
            className={styles.errorNotification}
            lowContrast={false}
            onClose={() => setShowErrorNotification(false)}
            title={t('error', 'Error')}
            subtitle={t('pleaseFillField', 'Please fill at least one field') + '.'}
          />
        </Column>
      )}
      <ButtonSet className={isTablet ? styles.tablet : styles.desktop}>
        <Button className={styles.button} kind="secondary" onClick={() => closeWorkspace()} type="button">
          {t('discard', 'Discard')}
        </Button>
        <Button className={styles.button} kind="primary" disabled={isSubmitting} type="submit">
          {t('submit', 'Save and close')}
        </Button>
      </ButtonSet>
    </Form>
  );
};

export default NewbornFluidBalanceForm;
