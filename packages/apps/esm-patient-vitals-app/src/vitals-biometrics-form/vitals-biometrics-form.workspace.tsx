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
import {
  age,
  createErrorHandler,
  ExtensionSlot,
  showSnackbar,
  useConfig,
  useLayoutType,
  usePatient,
  useSession,
  useVisit,
  Workspace2,
} from '@openmrs/esm-framework';
import {
  type DefaultPatientWorkspaceProps,
  type PatientWorkspace2DefinitionProps,
  useReferenceRanges,
} from '@openmrs/esm-patient-common-lib';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import {
  assessValue,
  getReferenceRangesForConcept,
  interpretBloodPressure,
  invalidateCachedVitalsAndBiometrics,
  saveVitalsAndBiometrics as savePatientVitals,
  useVitalsConceptMetadata,
} from '../common';
import type { ConfigObject } from '../config-schema';

import styles from './vitals-biometrics-form.scss';
import {
  calculateBodyMassIndex,
  extractNumbers,
  getMuacColorCode,
  isValueWithinReferenceRange,
} from './vitals-biometrics-form.utils';
import VitalsAndBiometricsInput from './vitals-biometrics-input.component';

const VitalsAndBiometricFormSchema = z
  .object({
    systolicBloodPressure: z.number(),
    diastolicBloodPressure: z.number(),
    respiratoryRate: z.number(),
    oxygenSaturation: z.number(),
    pulse: z.number(),
    temperature: z.number(),
    generalPatientNote: z.string(),
    weight: z.number(),
    height: z.number(),
    midUpperArmCircumference: z.number(),
    abdominalCircumference: z.number(),
    computedBodyMassIndex: z.number(),
  })
  .partial()
  .refine(
    (fields) => {
      return Object.values(fields).some((value) => value != null && value !== '');
    },
    {
      message: 'Please fill at least one field',
      path: ['oneFieldRequired'],
    },
  );

export type VitalsBiometricsFormData = z.infer<typeof VitalsAndBiometricFormSchema>;

type VitalsBiometricsWorkspace2Props = PatientWorkspace2DefinitionProps<object, object>;
type VitalsBiometricsWorkspaceProps = DefaultPatientWorkspaceProps | VitalsBiometricsWorkspace2Props;

function isWorkspace2Props(props: VitalsBiometricsWorkspaceProps): props is VitalsBiometricsWorkspace2Props {
  return 'groupProps' in props && 'workspaceProps' in props;
}

const VitalsAndBiometricsForm: React.FC<VitalsBiometricsWorkspaceProps> = (props) => {
  const { t } = useTranslation();
  const patientUuid = isWorkspace2Props(props) ? (props.groupProps?.patientUuid ?? '') : props.patientUuid;
  const isTablet = useLayoutType() === 'tablet';
  const config = useConfig<ConfigObject>();
  const biometricsUnitsSymbols = config.biometrics;
  const useMuacColorStatus = config.vitals.useMuacColors;

  const session = useSession();
  const patient = usePatient(patientUuid);
  const { currentVisit } = useVisit(patientUuid);
  const { data: conceptUnits, conceptMetadata, conceptRanges, isLoading } = useVitalsConceptMetadata();
  const biometricsConceptUuids = useMemo(
    () => [
      config.concepts.weightUuid,
      config.concepts.heightUuid,
      config.concepts.midUpperArmCircumferenceUuid,
      config.concepts.abdominalCircumferenceUuid,
    ],
    [
      config.concepts.abdominalCircumferenceUuid,
      config.concepts.heightUuid,
      config.concepts.midUpperArmCircumferenceUuid,
      config.concepts.weightUuid,
    ],
  );
  const { ranges: patientReferenceRanges, isLoading: isLoadingReferenceRanges } = useReferenceRanges(
    patientUuid,
    biometricsConceptUuids,
  );
  const [hasInvalidVitals, setHasInvalidVitals] = useState(false);
  const [muacColorCode, setMuacColorCode] = useState('');
  const [showErrorNotification, setShowErrorNotification] = useState(false);
  const [showErrorMessage, setShowErrorMessage] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { dirtyFields, isSubmitting },
  } = useForm<VitalsBiometricsFormData>({
    mode: 'all',
    resolver: zodResolver(VitalsAndBiometricFormSchema),
  });

  const hasUserUnsavedChanges = Object.keys(dirtyFields).length > 0;
  const workspaceTitle = t('recordVitalsAndBiometrics', 'Record Vitals and Biometrics');

  const closeCurrentWorkspace = useCallback(async () => {
    if (isWorkspace2Props(props)) {
      await props.closeWorkspace();
      return;
    }

    props.closeWorkspace();
  }, [props]);

  const closeCurrentWorkspaceWithSavedChanges = useCallback(async () => {
    if (isWorkspace2Props(props)) {
      await props.closeWorkspace({ discardUnsavedChanges: true });
      return;
    }

    props.closeWorkspaceWithSavedChanges();
  }, [props]);

  const renderWorkspace = useCallback(
    (content: React.ReactNode) => {
      if (isWorkspace2Props(props)) {
        return (
          <Workspace2 title={workspaceTitle} hasUnsavedChanges={hasUserUnsavedChanges}>
            {content}
          </Workspace2>
        );
      }

      return content;
    },
    [hasUserUnsavedChanges, props, workspaceTitle],
  );

  useEffect(() => {
    if (!isWorkspace2Props(props)) {
      props.promptBeforeClosing(() => hasUserUnsavedChanges);
    }
  }, [hasUserUnsavedChanges, props]);

  const encounterUuid = currentVisit?.encounters?.find(
    (encounter) => encounter?.form?.uuid === config.vitals.formUuid,
  )?.uuid;

  const midUpperArmCircumference = watch('midUpperArmCircumference');
  const systolicBloodPressure = watch('systolicBloodPressure');
  const diastolicBloodPressure = watch('diastolicBloodPressure');
  const respiratoryRate = watch('respiratoryRate');
  const oxygenSaturation = watch('oxygenSaturation');
  const temperature = watch('temperature');
  const pulse = watch('pulse');
  const weight = watch('weight');
  const height = watch('height');
  const abdominalCircumference = watch('abdominalCircumference');

  useEffect(() => {
    const patientBirthDate = patient?.patient?.birthDate;
    if (patientBirthDate && midUpperArmCircumference != null) {
      const patientAge = extractNumbers(age(patientBirthDate));
      getMuacColorCode(patientAge, midUpperArmCircumference, setMuacColorCode);
    }
  }, [patient.patient?.birthDate, midUpperArmCircumference]);

  useEffect(() => {
    if (height != null && weight != null) {
      const computedBodyMassIndex = calculateBodyMassIndex(weight, height);
      setValue('computedBodyMassIndex', computedBodyMassIndex);
    }
  }, [weight, height, setValue]);

  function onError(err: Record<string, { message?: string }>) {
    if (err?.oneFieldRequired) {
      setShowErrorNotification(true);
    }
  }

  const concepts = useMemo(
    () => ({
      midUpperArmCircumferenceRange: conceptRanges.get(config.concepts.midUpperArmCircumferenceUuid),
      abdominalCircumferenceRange:
        patientReferenceRanges.get(config.concepts.abdominalCircumferenceUuid) ??
        getReferenceRangesForConcept(config.concepts.abdominalCircumferenceUuid, conceptMetadata),
      diastolicBloodPressureRange: conceptRanges.get(config.concepts.diastolicBloodPressureUuid),
      systolicBloodPressureRange: conceptRanges.get(config.concepts.systolicBloodPressureUuid),
      oxygenSaturationRange: conceptRanges.get(config.concepts.oxygenSaturationUuid),
      respiratoryRateRange: conceptRanges.get(config.concepts.respiratoryRateUuid),
      temperatureRange: conceptRanges.get(config.concepts.temperatureUuid),
      weightRange: conceptRanges.get(config.concepts.weightUuid),
      heightRange: conceptRanges.get(config.concepts.heightUuid),
      pulseRange: conceptRanges.get(config.concepts.pulseUuid),
    }),
    [
      conceptRanges,
      conceptMetadata,
      patientReferenceRanges,
      config.concepts.abdominalCircumferenceUuid,
      config.concepts.diastolicBloodPressureUuid,
      config.concepts.heightUuid,
      config.concepts.midUpperArmCircumferenceUuid,
      config.concepts.oxygenSaturationUuid,
      config.concepts.pulseUuid,
      config.concepts.respiratoryRateUuid,
      config.concepts.systolicBloodPressureUuid,
      config.concepts.temperatureUuid,
      config.concepts.weightUuid,
    ],
  );

  const getPatientReferenceRange = useCallback(
    (conceptUuid: string) =>
      patientReferenceRanges.get(conceptUuid) ?? getReferenceRangesForConcept(conceptUuid, conceptMetadata),
    [conceptMetadata, patientReferenceRanges],
  );

  const savePatientVitalsAndBiometrics = useCallback(
    (data: VitalsBiometricsFormData) => {
      const { computedBodyMassIndex: _bmi, ...formData } = data;
      setShowErrorMessage(true);
      setShowErrorNotification(false);

      const allFieldsAreValid = Object.entries(formData)
        .filter(([, value]) => value != null && value !== '')
        .every(([key, value]) => {
          const conceptUuid = config.concepts[`${key}Uuid`];
          if (!conceptUuid) {
            return true;
          }
          return isValueWithinReferenceRange(
            conceptMetadata,
            conceptUuid,
            value,
            getPatientReferenceRange(conceptUuid),
          );
        });

      if (allFieldsAreValid) {
        setShowErrorMessage(false);

        const locationUuid = session?.sessionLocation?.uuid;
        if (!locationUuid) {
          showSnackbar({
            title: t('vitalsAndBiometricsSaveError', 'Error saving vitals and biometrics'),
            kind: 'error',
            isLowContrast: false,
            subtitle: t('noSessionLocation', 'Could not determine session location. Please log in again.'),
          });
          return;
        }

        const abortController = new AbortController();

        savePatientVitals(
          config.vitals.encounterTypeUuid,
          config.vitals.formUuid,
          config.concepts,
          patientUuid,
          formData,
          abortController,
          locationUuid,
        )
          .then((response) => {
            if (response.status === 201 || response.status === 200) {
              invalidateCachedVitalsAndBiometrics();
              void closeCurrentWorkspaceWithSavedChanges();
              showSnackbar({
                isLowContrast: true,
                kind: 'success',
                title: t('vitalsAndBiometricsRecorded', 'Vitals and Biometrics saved'),
                subtitle: t(
                  'vitalsAndBiometricsNowAvailable',
                  'They are now visible on the Vitals and Biometrics page',
                ),
              });
            }
          })
          .catch((error) => {
            createErrorHandler()(error);
            showSnackbar({
              title: t('vitalsAndBiometricsSaveError', 'Error saving vitals and biometrics'),
              kind: 'error',
              isLowContrast: false,
              subtitle: error?.message ?? t('unexpectedError', 'An unexpected error occurred. Please try again.'),
            });
          });
      } else {
        setHasInvalidVitals(true);
      }
    },
    [
      closeCurrentWorkspaceWithSavedChanges,
      conceptMetadata,
      config.concepts,
      config.vitals.encounterTypeUuid,
      config.vitals.formUuid,
      getPatientReferenceRange,
      patientUuid,
      session?.sessionLocation?.uuid,
      t,
    ],
  );

  if (config.vitals.useFormEngine) {
    return renderWorkspace(
      <ExtensionSlot
        name="form-widget-slot"
        state={{
          view: 'form',
          formUuid: config.vitals.formUuid,
          visitUuid: currentVisit?.uuid,
          visitTypeUuid: currentVisit?.visitType?.uuid,
          patientUuid: patientUuid ?? null,
          patient,
          encounterUuid,
          closeWorkspaceWithSavedChanges: closeCurrentWorkspaceWithSavedChanges,
        }}
      />,
    );
  }

  if (isLoading || isLoadingReferenceRanges) {
    return renderWorkspace(
      <Form className={styles.form}>
        <div className={styles.grid}>
          <Stack>
            <Column>
              <p className={styles.title}>{t('recordVitals', 'Record vitals')}</p>
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
      </Form>,
    );
  }

  return renderWorkspace(
    <Form className={styles.form} data-openmrs-role="Vitals and Biometrics Form">
      <div className={styles.grid}>
        <Stack>
          <Column>
            <p className={styles.title}>{t('recordVitals', 'Record vitals')}</p>
          </Column>
          <Row className={styles.row}>
            <Column>
              <VitalsAndBiometricsInput
                control={control}
                fieldProperties={[
                  {
                    id: 'temperature',
                    max: concepts.temperatureRange?.highAbsolute,
                    min: concepts.temperatureRange?.lowAbsolute,
                    name: t('temperature', 'Temperature'),
                    type: 'number',
                  },
                ]}
                interpretation={
                  temperature != null &&
                  assessValue(
                    temperature,
                    getReferenceRangesForConcept(config.concepts.temperatureUuid, conceptMetadata),
                  )
                }
                isValueWithinReferenceRange={
                  temperature
                    ? isValueWithinReferenceRange(conceptMetadata, config.concepts['temperatureUuid'], temperature)
                    : true
                }
                showErrorMessage={showErrorMessage}
                label={t('temperature', 'Temperature')}
                unitSymbol={conceptUnits.get(config.concepts.temperatureUuid) ?? ''}
              />
            </Column>
            <Column>
              <VitalsAndBiometricsInput
                control={control}
                fieldProperties={[
                  {
                    name: t('systolic', 'systolic'),
                    separator: '/',
                    type: 'number',
                    min: concepts.systolicBloodPressureRange?.lowAbsolute,
                    max: concepts.systolicBloodPressureRange?.highAbsolute,
                    id: 'systolicBloodPressure',
                  },
                  {
                    name: t('diastolic', 'diastolic'),
                    type: 'number',
                    min: concepts.diastolicBloodPressureRange?.lowAbsolute,
                    max: concepts.diastolicBloodPressureRange?.highAbsolute,
                    id: 'diastolicBloodPressure',
                  },
                ]}
                interpretation={
                  systolicBloodPressure != null &&
                  diastolicBloodPressure != null &&
                  interpretBloodPressure(
                    systolicBloodPressure,
                    diastolicBloodPressure,
                    config.concepts,
                    conceptMetadata,
                  )
                }
                isValueWithinReferenceRange={
                  systolicBloodPressure != null &&
                  diastolicBloodPressure != null &&
                  isValueWithinReferenceRange(
                    conceptMetadata,
                    config.concepts.systolicBloodPressureUuid,
                    systolicBloodPressure,
                  ) &&
                  isValueWithinReferenceRange(
                    conceptMetadata,
                    config.concepts.diastolicBloodPressureUuid,
                    diastolicBloodPressure,
                  )
                }
                showErrorMessage={showErrorMessage}
                label={t('bloodPressure', 'Blood pressure')}
                unitSymbol={conceptUnits.get(config.concepts.systolicBloodPressureUuid) ?? ''}
              />
            </Column>
            <Column>
              <VitalsAndBiometricsInput
                control={control}
                fieldProperties={[
                  {
                    name: t('pulse', 'Pulse'),
                    type: 'number',
                    min: concepts.pulseRange?.lowAbsolute,
                    max: concepts.pulseRange?.highAbsolute,
                    id: 'pulse',
                  },
                ]}
                interpretation={
                  pulse != null &&
                  assessValue(pulse, getReferenceRangesForConcept(config.concepts.pulseUuid, conceptMetadata))
                }
                isValueWithinReferenceRange={
                  pulse != null && isValueWithinReferenceRange(conceptMetadata, config.concepts['pulseUuid'], pulse)
                }
                label={t('heartRate', 'Heart rate')}
                showErrorMessage={showErrorMessage}
                unitSymbol={conceptUnits.get(config.concepts.pulseUuid) ?? ''}
              />
            </Column>
            <Column>
              <VitalsAndBiometricsInput
                control={control}
                fieldProperties={[
                  {
                    name: t('respirationRate', 'Respiration rate'),
                    type: 'number',
                    min: concepts.respiratoryRateRange?.lowAbsolute,
                    max: concepts.respiratoryRateRange?.highAbsolute,
                    id: 'respiratoryRate',
                  },
                ]}
                interpretation={
                  respiratoryRate != null &&
                  assessValue(
                    respiratoryRate,
                    getReferenceRangesForConcept(config.concepts.respiratoryRateUuid, conceptMetadata),
                  )
                }
                isValueWithinReferenceRange={
                  respiratoryRate != null &&
                  isValueWithinReferenceRange(conceptMetadata, config.concepts['respiratoryRateUuid'], respiratoryRate)
                }
                showErrorMessage={showErrorMessage}
                label={t('respirationRate', 'Respiration rate')}
                unitSymbol={conceptUnits.get(config.concepts.respiratoryRateUuid) ?? ''}
              />
            </Column>
            <Column>
              <VitalsAndBiometricsInput
                control={control}
                fieldProperties={[
                  {
                    name: t('oxygenSaturation', 'Oxygen saturation'),
                    type: 'number',
                    min: concepts.oxygenSaturationRange?.lowAbsolute,
                    max: concepts.oxygenSaturationRange?.highAbsolute,
                    id: 'oxygenSaturation',
                  },
                ]}
                interpretation={
                  oxygenSaturation != null &&
                  assessValue(
                    oxygenSaturation,
                    getReferenceRangesForConcept(config.concepts.oxygenSaturationUuid, conceptMetadata),
                  )
                }
                isValueWithinReferenceRange={
                  oxygenSaturation != null &&
                  isValueWithinReferenceRange(
                    conceptMetadata,
                    config.concepts['oxygenSaturationUuid'],
                    oxygenSaturation,
                  )
                }
                showErrorMessage={showErrorMessage}
                label={t('spo2', 'SpO2')}
                unitSymbol={conceptUnits.get(config.concepts.oxygenSaturationUuid) ?? ''}
              />
            </Column>
          </Row>

          <Row className={styles.row}>
            <Column className={styles.noteInput}>
              <VitalsAndBiometricsInput
                control={control}
                fieldWidth={isTablet ? '70%' : '100%'}
                fieldProperties={[
                  {
                    name: t('notes', 'Notes'),
                    type: 'textarea',
                    id: 'generalPatientNote',
                  },
                ]}
                placeholder={t('additionalNoteText', 'Type any additional notes here')}
                label={t('notes', 'Notes')}
              />
            </Column>
          </Row>
        </Stack>
        <Stack className={styles.spacer}>
          <Column>
            <p className={styles.title}>{t('recordBiometrics', 'Record biometrics')}</p>
          </Column>
          <Row className={styles.row}>
            <Column>
              <VitalsAndBiometricsInput
                control={control}
                fieldProperties={[
                  {
                    name: t('weight', 'Weight'),
                    type: 'number',
                    min: concepts.weightRange?.lowAbsolute,
                    max: concepts.weightRange?.highAbsolute,
                    id: 'weight',
                  },
                ]}
                interpretation={
                  weight != null && assessValue(weight, getPatientReferenceRange(config.concepts.weightUuid))
                }
                isValueWithinReferenceRange={
                  weight
                    ? isValueWithinReferenceRange(
                        conceptMetadata,
                        config.concepts['weightUuid'],
                        weight,
                        getPatientReferenceRange(config.concepts.weightUuid),
                      )
                    : true
                }
                showErrorMessage={showErrorMessage}
                label={t('weight', 'Weight')}
                unitSymbol={conceptUnits.get(config.concepts.weightUuid) ?? ''}
              />
            </Column>
            <Column>
              <VitalsAndBiometricsInput
                control={control}
                fieldProperties={[
                  {
                    name: t('height', 'Height'),
                    type: 'number',
                    min: concepts.heightRange?.lowAbsolute,
                    max: concepts.heightRange?.highAbsolute,
                    id: 'height',
                  },
                ]}
                interpretation={
                  height != null && assessValue(height, getPatientReferenceRange(config.concepts.heightUuid))
                }
                isValueWithinReferenceRange={
                  height
                    ? isValueWithinReferenceRange(
                        conceptMetadata,
                        config.concepts['heightUuid'],
                        height,
                        getPatientReferenceRange(config.concepts.heightUuid),
                      )
                    : true
                }
                showErrorMessage={showErrorMessage}
                label={t('height', 'Height')}
                unitSymbol={conceptUnits.get(config.concepts.heightUuid) ?? ''}
              />
            </Column>
            <Column>
              <VitalsAndBiometricsInput
                control={control}
                fieldProperties={[
                  {
                    name: t('bmi', 'BMI'),
                    type: 'number',
                    id: 'computedBodyMassIndex',
                  },
                ]}
                readOnly
                label={t('calculatedBmi', 'BMI (calc.)')}
                unitSymbol={biometricsUnitsSymbols['bmiUnit']}
              />
            </Column>
            <Column>
              <VitalsAndBiometricsInput
                control={control}
                fieldProperties={[
                  {
                    name: t('abdominalCircumference', 'Abdominal circumference'),
                    type: 'number',
                    min: concepts.abdominalCircumferenceRange?.lowAbsolute,
                    max: concepts.abdominalCircumferenceRange?.hiAbsolute,
                    id: 'abdominalCircumference',
                  },
                ]}
                interpretation={
                  abdominalCircumference != null &&
                  assessValue(
                    abdominalCircumference,
                    getPatientReferenceRange(config.concepts.abdominalCircumferenceUuid),
                  )
                }
                isValueWithinReferenceRange={
                  abdominalCircumference
                    ? isValueWithinReferenceRange(
                        conceptMetadata,
                        config.concepts['abdominalCircumferenceUuid'],
                        abdominalCircumference,
                        getPatientReferenceRange(config.concepts.abdominalCircumferenceUuid),
                      )
                    : true
                }
                showErrorMessage={showErrorMessage}
                label={t('abdominalCircumference', 'Abdominal circumference')}
                unitSymbol={
                  conceptUnits.get(config.concepts.abdominalCircumferenceUuid) ??
                  concepts.abdominalCircumferenceRange?.units ??
                  config.biometrics.abdominalCircumferenceUnit
                }
              />
            </Column>
            <Column>
              <VitalsAndBiometricsInput
                control={control}
                fieldProperties={[
                  {
                    name: t('muac', 'MUAC'),
                    type: 'number',
                    min: concepts.midUpperArmCircumferenceRange?.lowAbsolute,
                    max: concepts.midUpperArmCircumferenceRange?.highAbsolute,
                    id: 'midUpperArmCircumference',
                  },
                ]}
                muacColorCode={muacColorCode}
                isValueWithinReferenceRange={
                  midUpperArmCircumference
                    ? isValueWithinReferenceRange(
                        conceptMetadata,
                        config.concepts['midUpperArmCircumferenceUuid'],
                        midUpperArmCircumference,
                      )
                    : true
                }
                showErrorMessage={showErrorMessage}
                label={t('muac', 'MUAC')}
                unitSymbol={conceptUnits.get(config.concepts.midUpperArmCircumferenceUuid) ?? ''}
                useMuacColors={useMuacColorStatus}
              />
            </Column>
          </Row>
        </Stack>
      </div>

      {showErrorNotification && (
        <Column className={styles.errorContainer}>
          <InlineNotification
            lowContrast
            title={t('error', 'Error')}
            subtitle={t('pleaseFillField', 'Please fill at least one field') + '.'}
            onClose={() => setShowErrorNotification(false)}
          />
        </Column>
      )}

      {hasInvalidVitals && (
        <Column className={styles.errorContainer}>
          <InlineNotification
            className={styles.errorNotification}
            lowContrast={false}
            onClose={() => setHasInvalidVitals(false)}
            title={t('vitalsAndBiometricsSaveError', 'Error saving vitals and biometrics')}
            subtitle={t('checkForValidity', 'Some of the values entered are invalid')}
          />
        </Column>
      )}

      <ButtonSet className={isTablet ? styles.tablet : styles.desktop}>
        <Button className={styles.button} kind="secondary" onClick={() => void closeCurrentWorkspace()}>
          {t('discard', 'Discard')}
        </Button>
        <Button
          className={styles.button}
          kind="primary"
          onClick={handleSubmit(savePatientVitalsAndBiometrics, onError)}
          disabled={isSubmitting}
          type="submit"
        >
          {t('saveAndClose', 'Save and close')}
        </Button>
      </ButtonSet>
    </Form>,
  );
};

export default VitalsAndBiometricsForm;
