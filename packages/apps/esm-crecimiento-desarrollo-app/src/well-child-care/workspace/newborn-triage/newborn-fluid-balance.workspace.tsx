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
  .refine((fields) => Object.values(fields).some((value) => Boolean(value)), {
    message: 'Please fill at least one field',
    path: ['oneFieldRequired'],
  });

export type FluidBalanceFormType = z.infer<typeof FluidBalanceSchema>;

const NewbornFluidBalanceForm: React.FC<DefaultPatientWorkspaceProps> = ({ closeWorkspace, workspaceProps }) => {
  const patientUuid = workspaceProps?.patientUuid ?? '';
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const config = useConfig<ConfigObject>();
  const session = useSession();
  const { data: conceptUnits, conceptMetadata, conceptRanges, isLoading } = useVitalsConceptMetadata();
  const [showErrorNotification, setShowErrorNotification] = useState(false);
  const [_showErrorMessage, setShowErrorMessage] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FluidBalanceFormType>({
    mode: 'all',
    resolver: zodResolver(FluidBalanceSchema),
  });

  const _concepts = useMemo(
    () => ({
      stoolCountRange: conceptRanges.get(config.concepts.stoolCountUuid),
      stoolGramsRange: conceptRanges.get(config.concepts.stoolGramsUuid),
      urineCountRange: conceptRanges.get(config.concepts.urineCountUuid),
      urineGramsRange: conceptRanges.get(config.concepts.urineGramsUuid),
      vomitCountRange: conceptRanges.get(config.concepts.vomitCountUuid),
      vomitGramsMLRange: conceptRanges.get(config.concepts.vomitGramsMLUuid),
    }),
    [
      conceptRanges,
      config.concepts.stoolCountUuid,
      config.concepts.stoolGramsUuid,
      config.concepts.urineCountUuid,
      config.concepts.urineGramsUuid,
      config.concepts.vomitCountUuid,
      config.concepts.vomitGramsMLUuid,
    ],
  );

  const saveFluidBalance = useCallback(
    (data: FluidBalanceFormType) => {
      setShowErrorMessage(true);
      setShowErrorNotification(false);

      const allFieldsAreValid = Object.entries(data)
        .filter(([, value]) => Boolean(value))
        .every(([key, value]) => isValueWithinReferenceRange(conceptMetadata, config.concepts[`${key}Uuid`], value));

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
      conceptMetadata,
      config.concepts,
      config.vitals.encounterTypeUuid,
      config.vitals.formUuid,
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
            <NewbornVitalsInput
              control={control}
              label={t('stoolCount', 'Stool Count')}
              fieldProperties={[{ id: 'stoolCount', name: 'Stool Count', type: 'number', min: 0, max: 20 }]}
              unitSymbol={conceptUnits.get(config.concepts.stoolCountUuid) ?? ''} // Usar conceptUnits
            />
            <NewbornVitalsInput
              control={control}
              label={t('stoolGrams', 'Stool Weight (g)')}
              fieldProperties={[{ id: 'stoolGrams', name: 'Grams', type: 'number', min: 0 }]}
              unitSymbol={conceptUnits.get(config.concepts.stoolGramsUuid) ?? 'g'} // Usar conceptUnits con fallback
            />
            <NewbornVitalsInput
              control={control}
              label={t('urineCount', 'Urine Count')}
              fieldProperties={[{ id: 'urineCount', name: 'Urine Count', type: 'number', min: 0, max: 20 }]}
              unitSymbol={conceptUnits.get(config.concepts.urineCountUuid) ?? ''} // Usar conceptUnits
            />
            <NewbornVitalsInput
              control={control}
              label={t('urineGrams', 'Urine Volume (g/mL)')}
              fieldProperties={[{ id: 'urineGrams', name: 'Grams', type: 'number', min: 0 }]}
              unitSymbol={conceptUnits.get(config.concepts.urineGramsUuid) ?? 'g/mL'} // Usar conceptUnits con fallback
            />
          </Row>
          <Row className={styles.row}>
            <NewbornVitalsInput
              control={control}
              label={t('vomitCount', 'Vomit Count')}
              fieldProperties={[{ id: 'vomitCount', name: 'Vomit Count', type: 'number', min: 0, max: 20 }]}
              unitSymbol={conceptUnits.get(config.concepts.vomitCountUuid) ?? ''} // Usar conceptUnits
            />
            <NewbornVitalsInput
              control={control}
              label={t('vomitGramsML', 'Vomit Volume (g/mL)')}
              fieldProperties={[{ id: 'vomitGramsML', name: 'Grams', type: 'number', min: 0 }]}
              unitSymbol={conceptUnits.get(config.concepts.vomitGramsMLUuid) ?? 'g/mL'} // Usar conceptUnits con fallback
            />
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
