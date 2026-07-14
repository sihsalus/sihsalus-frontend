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
  Workspace2,
} from '@openmrs/esm-framework';
import {
  type DefaultPatientWorkspaceProps,
  type PatientWorkspace2DefinitionProps,
  useReferenceRanges,
  useVisitOrOfflineVisit,
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
  type ConditionalFieldOverrides,
  calculateBodyMassIndex,
  calculateGlasgowComaScaleTotal,
  extractNumbers,
  getAgeInDays,
  getMuacColorCode,
  isConditionalFieldVisible,
  isValueWithinReferenceRange,
  type VitalsBiometricsWorkspaceProfile,
} from './vitals-biometrics-form.utils';
import VitalsAndBiometricsInput from './vitals-biometrics-input.component';

const glasgowFieldKeys = ['glasgowEyeOpening', 'glasgowVerbalResponse', 'glasgowMotorResponse'] as const;

interface GlasgowComaScaleOption {
  label: string;
  score?: number;
  value: string;
}

const GLASGOW_ANSWER_UUIDS = {
  eyeOpeningSpontaneous: 'faff1dec-14df-44d4-8695-b337dced2274',
  eyeOpeningToSpeech: '2120199e-03ed-4986-892f-52a3d13b92c0',
  eyeOpeningToPain: '1633ea34-bc65-4a87-9fec-8fef231b85cf',
  eyeOpeningNone: '8b4ee185-b709-4cfa-b3db-f15d565ddc04',
  eyeOpeningNotTestable: '25c71769-dddb-4d06-a858-cde05e2087e2',
  verbalResponseOriented: '6440f83b-657e-4c5c-bac5-e3f67660ea4e',
  verbalResponseConfused: '52066114-63ee-48ca-a09b-fa9c0c7f73ba',
  verbalResponseInappropriateWords: '0b5820f1-f968-4950-bc62-ad54c6166723',
  verbalResponseIncomprehensibleSounds: '245c6329-b810-4db3-bdc1-62bb9cdc0f31',
  verbalResponseNone: '1d01f180-1acd-4121-b380-049f4bbb4af7',
  verbalResponseNotTestable: 'fd4b9335-0f74-453e-b787-46d303a9b3b5',
  motorResponseObeysCommands: 'bddbf4e2-c870-4515-924e-d98cfcb7948f',
  motorResponseLocalizesPain: '355eb0e2-c319-4536-9837-43bf3c23f592',
  motorResponseWithdrawsFromPain: 'a815a9d0-a033-48bc-89e9-836a15b9a3b2',
  motorResponseAbnormalFlexion: '795e56c8-e783-470e-8b83-3ee11300f4a7',
  motorResponseExtension: 'b4e10f1d-09e2-4b6b-8471-466c25da1b79',
  motorResponseNone: '7e16856d-c686-4921-ba7f-65f7bf15771a',
  motorResponseNotTestable: '09957de5-8eb7-4865-8e29-e946cf895bc4',
} as const;

const GLASGOW_SCORE_BY_ANSWER_UUID: Record<string, number | undefined> = {
  [GLASGOW_ANSWER_UUIDS.eyeOpeningSpontaneous]: 4,
  [GLASGOW_ANSWER_UUIDS.eyeOpeningToSpeech]: 3,
  [GLASGOW_ANSWER_UUIDS.eyeOpeningToPain]: 2,
  [GLASGOW_ANSWER_UUIDS.eyeOpeningNone]: 1,
  [GLASGOW_ANSWER_UUIDS.eyeOpeningNotTestable]: undefined,
  [GLASGOW_ANSWER_UUIDS.verbalResponseOriented]: 5,
  [GLASGOW_ANSWER_UUIDS.verbalResponseConfused]: 4,
  [GLASGOW_ANSWER_UUIDS.verbalResponseInappropriateWords]: 3,
  [GLASGOW_ANSWER_UUIDS.verbalResponseIncomprehensibleSounds]: 2,
  [GLASGOW_ANSWER_UUIDS.verbalResponseNone]: 1,
  [GLASGOW_ANSWER_UUIDS.verbalResponseNotTestable]: undefined,
  [GLASGOW_ANSWER_UUIDS.motorResponseObeysCommands]: 6,
  [GLASGOW_ANSWER_UUIDS.motorResponseLocalizesPain]: 5,
  [GLASGOW_ANSWER_UUIDS.motorResponseWithdrawsFromPain]: 4,
  [GLASGOW_ANSWER_UUIDS.motorResponseAbnormalFlexion]: 3,
  [GLASGOW_ANSWER_UUIDS.motorResponseExtension]: 2,
  [GLASGOW_ANSWER_UUIDS.motorResponseNone]: 1,
  [GLASGOW_ANSWER_UUIDS.motorResponseNotTestable]: undefined,
};

function getGlasgowScore(value: string | undefined) {
  return value ? GLASGOW_SCORE_BY_ANSWER_UUID[value] : undefined;
}

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
    headCircumference: z.number(),
    chestCircumference: z.number(),
    glasgowEyeOpening: z.string(),
    glasgowVerbalResponse: z.string(),
    glasgowMotorResponse: z.string(),
    glasgowTotal: z.number(),
    computedBodyMassIndex: z.number(),
  })
  .partial()
  .refine(
    (fields) => {
      const completedGlasgowFields = glasgowFieldKeys.filter((field) => fields[field] != null);
      return completedGlasgowFields.length === 0 || completedGlasgowFields.length === glasgowFieldKeys.length;
    },
    {
      message: 'Please complete all Glasgow coma scale fields',
      path: ['glasgowComaScale'],
    },
  )
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

export interface VitalsBiometricsSavedPayload {
  encounterTypeUuid: string;
  formData: VitalsBiometricsFormData;
  patientUuid: string;
  visitUuid: string;
}

interface VitalsBiometricsWorkspaceOverrides extends ConditionalFieldOverrides {
  encounterTypeUuid?: string;
  onVitalsSaved?: (payload: VitalsBiometricsSavedPayload) => Promise<void> | void;
  profile?: VitalsBiometricsWorkspaceProfile;
}

type VitalsBiometricsWorkspace2Props = PatientWorkspace2DefinitionProps<VitalsBiometricsWorkspaceOverrides, object>;
type VitalsBiometricsWorkspaceProps =
  | (DefaultPatientWorkspaceProps & VitalsBiometricsWorkspaceOverrides)
  | VitalsBiometricsWorkspace2Props;

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
  const { currentVisit } = useVisitOrOfflineVisit(patientUuid);
  const { data: conceptUnits, conceptMetadata, conceptRanges, isLoading } = useVitalsConceptMetadata();
  const referenceRangeConceptUuids = useMemo(
    () => [
      config.concepts.temperatureUuid,
      config.concepts.weightUuid,
      config.concepts.heightUuid,
      config.concepts.midUpperArmCircumferenceUuid,
      config.concepts.abdominalCircumferenceUuid,
      config.concepts.headCircumferenceUuid,
      config.concepts.chestCircumferenceUuid,
    ],
    [
      config.concepts.temperatureUuid,
      config.concepts.weightUuid,
      config.concepts.heightUuid,
      config.concepts.midUpperArmCircumferenceUuid,
      config.concepts.abdominalCircumferenceUuid,
      config.concepts.headCircumferenceUuid,
      config.concepts.chestCircumferenceUuid,
    ],
  );
  const { ranges: patientReferenceRanges, isLoading: isLoadingReferenceRanges } = useReferenceRanges(
    patientUuid,
    referenceRangeConceptUuids,
  );
  const [hasInvalidVitals, setHasInvalidVitals] = useState(false);
  const [muacColorCode, setMuacColorCode] = useState('');
  const [showErrorNotification, setShowErrorNotification] = useState(false);
  const [showErrorMessage, setShowErrorMessage] = useState(false);
  const [formErrorMessage, setFormErrorMessage] = useState('');

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
  const headCircumference = watch('headCircumference');
  const chestCircumference = watch('chestCircumference');
  const glasgowEyeOpening = watch('glasgowEyeOpening');
  const glasgowVerbalResponse = watch('glasgowVerbalResponse');
  const glasgowMotorResponse = watch('glasgowMotorResponse');

  const workspaceOverrides: VitalsBiometricsWorkspaceOverrides = isWorkspace2Props(props)
    ? (props.workspaceProps ?? {})
    : props;
  const fieldOverrides: ConditionalFieldOverrides = workspaceOverrides;
  const workspaceProfile = workspaceOverrides.profile ?? 'default';
  const encounterTypeUuid = workspaceOverrides.encounterTypeUuid ?? config.vitals.encounterTypeUuid;
  const showGlasgowComaScale =
    !fieldOverrides.hideFields?.includes('glasgowComaScale') &&
    config.vitals.glasgowComaScale.enabled &&
    (workspaceProfile === 'emergency-triage' || Boolean(fieldOverrides.showFields?.includes('glasgowComaScale')));
  const ageInDays = getAgeInDays(patient?.patient?.birthDate);
  const showHeadCircumference = isConditionalFieldVisible(
    'headCircumference',
    config.biometrics.headCircumference,
    ageInDays,
    fieldOverrides,
  );
  const showChestCircumference = isConditionalFieldVisible(
    'chestCircumference',
    config.biometrics.chestCircumference,
    ageInDays,
    fieldOverrides,
  );

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

  useEffect(() => {
    setValue(
      'glasgowTotal',
      calculateGlasgowComaScaleTotal(
        getGlasgowScore(glasgowEyeOpening),
        getGlasgowScore(glasgowVerbalResponse),
        getGlasgowScore(glasgowMotorResponse),
      ),
      {
        shouldDirty: false,
        shouldTouch: false,
      },
    );
  }, [glasgowEyeOpening, glasgowMotorResponse, glasgowVerbalResponse, setValue]);

  function onError(err: Record<string, { message?: string }>) {
    if (err?.oneFieldRequired) {
      setShowErrorMessage(false);
      setFormErrorMessage(t('pleaseFillField', 'Please fill at least one field'));
      setShowErrorNotification(true);
      return;
    }

    if (err?.glasgowComaScale) {
      setShowErrorMessage(false);
      setFormErrorMessage(t('completeGlasgowComaScale', 'Please complete all Glasgow coma scale fields'));
      setShowErrorNotification(true);
    }
  }

  const concepts = useMemo(
    () => ({
      midUpperArmCircumferenceRange: conceptRanges.get(config.concepts.midUpperArmCircumferenceUuid),
      abdominalCircumferenceRange:
        patientReferenceRanges.get(config.concepts.abdominalCircumferenceUuid) ??
        getReferenceRangesForConcept(config.concepts.abdominalCircumferenceUuid, conceptMetadata),
      headCircumferenceRange:
        patientReferenceRanges.get(config.concepts.headCircumferenceUuid) ??
        getReferenceRangesForConcept(config.concepts.headCircumferenceUuid, conceptMetadata),
      chestCircumferenceRange:
        patientReferenceRanges.get(config.concepts.chestCircumferenceUuid) ??
        getReferenceRangesForConcept(config.concepts.chestCircumferenceUuid, conceptMetadata),
      diastolicBloodPressureRange: conceptRanges.get(config.concepts.diastolicBloodPressureUuid),
      systolicBloodPressureRange: conceptRanges.get(config.concepts.systolicBloodPressureUuid),
      oxygenSaturationRange: conceptRanges.get(config.concepts.oxygenSaturationUuid),
      respiratoryRateRange: conceptRanges.get(config.concepts.respiratoryRateUuid),
      temperatureRange: patientReferenceRanges.has(config.concepts.temperatureUuid)
        ? {
            lowAbsolute: patientReferenceRanges.get(config.concepts.temperatureUuid)?.lowAbsolute ?? null,
            highAbsolute: patientReferenceRanges.get(config.concepts.temperatureUuid)?.hiAbsolute ?? null,
          }
        : conceptRanges.get(config.concepts.temperatureUuid),
      weightRange: conceptRanges.get(config.concepts.weightUuid),
      heightRange: conceptRanges.get(config.concepts.heightUuid),
      pulseRange: conceptRanges.get(config.concepts.pulseUuid),
    }),
    [
      conceptRanges,
      conceptMetadata,
      patientReferenceRanges,
      config.concepts.abdominalCircumferenceUuid,
      config.concepts.chestCircumferenceUuid,
      config.concepts.headCircumferenceUuid,
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
      const { computedBodyMassIndex: _bmi, glasgowTotal: _glasgowTotal, ...rawFormData } = data;
      const computedGlasgowTotal = calculateGlasgowComaScaleTotal(
        getGlasgowScore(rawFormData.glasgowEyeOpening),
        getGlasgowScore(rawFormData.glasgowVerbalResponse),
        getGlasgowScore(rawFormData.glasgowMotorResponse),
      );
      const formData = {
        ...rawFormData,
        ...(computedGlasgowTotal != null ? { glasgowTotal: computedGlasgowTotal } : {}),
      };
      setShowErrorMessage(true);
      setShowErrorNotification(false);
      setFormErrorMessage('');

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

        if (!currentVisit?.uuid || currentVisit.stopDatetime) {
          showSnackbar({
            title: t('vitalsAndBiometricsSaveError', 'Error saving vitals and biometrics'),
            kind: 'error',
            isLowContrast: false,
            subtitle: t('noActiveVisit', 'An active visit is required to record vitals and biometrics.'),
          });
          return;
        }

        const abortController = new AbortController();

        savePatientVitals(
          encounterTypeUuid,
          config.concepts,
          patientUuid,
          formData,
          abortController,
          locationUuid,
          currentVisit.uuid,
        )
          .then(async (response) => {
            if (response.status === 201 || response.status === 200) {
              await workspaceOverrides.onVitalsSaved?.({
                encounterTypeUuid,
                formData,
                patientUuid,
                visitUuid: currentVisit.uuid,
              });
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
      currentVisit?.stopDatetime,
      currentVisit?.uuid,
      encounterTypeUuid,
      getPatientReferenceRange,
      patientUuid,
      session?.sessionLocation?.uuid,
      t,
      workspaceOverrides,
    ],
  );

  const glasgowEyeOpeningOptions = useMemo<Array<GlasgowComaScaleOption>>(
    () => [
      {
        value: GLASGOW_ANSWER_UUIDS.eyeOpeningSpontaneous,
        score: 4,
        label: t('glasgowEyeOpeningSpontaneous', '4 - Spontaneous'),
      },
      {
        value: GLASGOW_ANSWER_UUIDS.eyeOpeningToSpeech,
        score: 3,
        label: t('glasgowEyeOpeningToSpeech', '3 - To speech'),
      },
      {
        value: GLASGOW_ANSWER_UUIDS.eyeOpeningToPain,
        score: 2,
        label: t('glasgowEyeOpeningToPain', '2 - To pain'),
      },
      {
        value: GLASGOW_ANSWER_UUIDS.eyeOpeningNone,
        score: 1,
        label: t('glasgowEyeOpeningNone', '1 - None'),
      },
      {
        value: GLASGOW_ANSWER_UUIDS.eyeOpeningNotTestable,
        label: t('glasgowEyeOpeningNotTestable', 'Not testable'),
      },
    ],
    [t],
  );

  const glasgowVerbalResponseOptions = useMemo<Array<GlasgowComaScaleOption>>(
    () => [
      {
        value: GLASGOW_ANSWER_UUIDS.verbalResponseOriented,
        score: 5,
        label: t('glasgowVerbalResponseOriented', '5 - Oriented'),
      },
      {
        value: GLASGOW_ANSWER_UUIDS.verbalResponseConfused,
        score: 4,
        label: t('glasgowVerbalResponseConfused', '4 - Confused'),
      },
      {
        value: GLASGOW_ANSWER_UUIDS.verbalResponseInappropriateWords,
        score: 3,
        label: t('glasgowVerbalResponseInappropriateWords', '3 - Inappropriate words'),
      },
      {
        value: GLASGOW_ANSWER_UUIDS.verbalResponseIncomprehensibleSounds,
        score: 2,
        label: t('glasgowVerbalResponseIncomprehensibleSounds', '2 - Incomprehensible sounds'),
      },
      {
        value: GLASGOW_ANSWER_UUIDS.verbalResponseNone,
        score: 1,
        label: t('glasgowVerbalResponseNone', '1 - None'),
      },
      {
        value: GLASGOW_ANSWER_UUIDS.verbalResponseNotTestable,
        label: t('glasgowVerbalResponseNotTestable', 'Not testable'),
      },
    ],
    [t],
  );

  const glasgowMotorResponseOptions = useMemo<Array<GlasgowComaScaleOption>>(
    () => [
      {
        value: GLASGOW_ANSWER_UUIDS.motorResponseObeysCommands,
        score: 6,
        label: t('glasgowMotorResponseObeysCommands', '6 - Obeys commands'),
      },
      {
        value: GLASGOW_ANSWER_UUIDS.motorResponseLocalizesPain,
        score: 5,
        label: t('glasgowMotorResponseLocalizesPain', '5 - Localizes pain'),
      },
      {
        value: GLASGOW_ANSWER_UUIDS.motorResponseWithdrawsFromPain,
        score: 4,
        label: t('glasgowMotorResponseWithdrawsFromPain', '4 - Withdraws from pain'),
      },
      {
        value: GLASGOW_ANSWER_UUIDS.motorResponseAbnormalFlexion,
        score: 3,
        label: t('glasgowMotorResponseAbnormalFlexion', '3 - Abnormal flexion'),
      },
      {
        value: GLASGOW_ANSWER_UUIDS.motorResponseExtension,
        score: 2,
        label: t('glasgowMotorResponseExtension', '2 - Extension'),
      },
      {
        value: GLASGOW_ANSWER_UUIDS.motorResponseNone,
        score: 1,
        label: t('glasgowMotorResponseNone', '1 - None'),
      },
      {
        value: GLASGOW_ANSWER_UUIDS.motorResponseNotTestable,
        label: t('glasgowMotorResponseNotTestable', 'Not testable'),
      },
    ],
    [t],
  );

  if (config.vitals.useFormEngine) {
    return renderWorkspace(
      <ExtensionSlot
        name="form-widget-slot"
        state={{
          view: 'form',
          formUuid: config.vitals.formUuid,
          encounterTypeUuid,
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
                  assessValue(temperature, getPatientReferenceRange(config.concepts.temperatureUuid))
                }
                isValueWithinReferenceRange={
                  temperature
                    ? isValueWithinReferenceRange(
                        conceptMetadata,
                        config.concepts.temperatureUuid,
                        temperature,
                        getPatientReferenceRange(config.concepts.temperatureUuid),
                      )
                    : true
                }
                showErrorMessage={showErrorMessage}
                showRequiredIndicator={workspaceProfile === 'emergency-triage'}
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
                    integer: true,
                    min: concepts.systolicBloodPressureRange?.lowAbsolute,
                    max: concepts.systolicBloodPressureRange?.highAbsolute,
                    id: 'systolicBloodPressure',
                  },
                  {
                    name: t('diastolic', 'diastolic'),
                    type: 'number',
                    integer: true,
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
                showRequiredIndicator={workspaceProfile === 'emergency-triage'}
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
                    integer: true,
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
                showRequiredIndicator={workspaceProfile === 'emergency-triage'}
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
                    integer: true,
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
                showRequiredIndicator={workspaceProfile === 'emergency-triage'}
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
                    integer: true,
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
                showRequiredIndicator={workspaceProfile === 'emergency-triage'}
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
        {showGlasgowComaScale && (
          <Stack className={styles.spacer}>
            <Column>
              <p className={styles.title}>{t('glasgowComaScale', 'Glasgow coma scale')}</p>
            </Column>
            <Row className={styles.row}>
              <Column>
                <VitalsAndBiometricsInput
                  control={control}
                  fieldWidth={isTablet ? '70%' : '13.5rem'}
                  fieldProperties={[
                    {
                      name: t('glasgowEyeOpening', 'Eye opening'),
                      type: 'select',
                      id: 'glasgowEyeOpening',
                      options: glasgowEyeOpeningOptions,
                    },
                  ]}
                  label={t('glasgowEyeOpening', 'Eye opening')}
                />
              </Column>
              <Column>
                <VitalsAndBiometricsInput
                  control={control}
                  fieldWidth={isTablet ? '70%' : '13.5rem'}
                  fieldProperties={[
                    {
                      name: t('glasgowVerbalResponse', 'Verbal response'),
                      type: 'select',
                      id: 'glasgowVerbalResponse',
                      options: glasgowVerbalResponseOptions,
                    },
                  ]}
                  label={t('glasgowVerbalResponse', 'Verbal response')}
                />
              </Column>
              <Column>
                <VitalsAndBiometricsInput
                  control={control}
                  fieldWidth={isTablet ? '70%' : '13.5rem'}
                  fieldProperties={[
                    {
                      name: t('glasgowMotorResponse', 'Motor response'),
                      type: 'select',
                      id: 'glasgowMotorResponse',
                      options: glasgowMotorResponseOptions,
                    },
                  ]}
                  label={t('glasgowMotorResponse', 'Motor response')}
                />
              </Column>
              <Column>
                <VitalsAndBiometricsInput
                  control={control}
                  fieldProperties={[
                    {
                      name: t('glasgowTotal', 'Glasgow total'),
                      type: 'number',
                      min: 3,
                      max: 15,
                      id: 'glasgowTotal',
                    },
                  ]}
                  readOnly
                  label={t('glasgowTotal', 'Glasgow total')}
                  unitSymbol={t('points', 'points')}
                />
              </Column>
            </Row>
          </Stack>
        )}
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
            {showHeadCircumference && (
              <Column>
                <VitalsAndBiometricsInput
                  control={control}
                  fieldProperties={[
                    {
                      name: t('headCircumference', 'Head circumference'),
                      type: 'number',
                      min: concepts.headCircumferenceRange?.lowAbsolute,
                      max: concepts.headCircumferenceRange?.hiAbsolute,
                      id: 'headCircumference',
                    },
                  ]}
                  interpretation={
                    headCircumference != null &&
                    assessValue(headCircumference, getPatientReferenceRange(config.concepts.headCircumferenceUuid))
                  }
                  isValueWithinReferenceRange={
                    headCircumference
                      ? isValueWithinReferenceRange(
                          conceptMetadata,
                          config.concepts['headCircumferenceUuid'],
                          headCircumference,
                          getPatientReferenceRange(config.concepts.headCircumferenceUuid),
                        )
                      : true
                  }
                  showErrorMessage={showErrorMessage}
                  label={t('headCircumference', 'Head circumference')}
                  unitSymbol={
                    conceptUnits.get(config.concepts.headCircumferenceUuid) ??
                    concepts.headCircumferenceRange?.units ??
                    config.biometrics.headCircumference.unit
                  }
                />
              </Column>
            )}
            {showChestCircumference && (
              <Column>
                <VitalsAndBiometricsInput
                  control={control}
                  fieldProperties={[
                    {
                      name: t('chestCircumference', 'Chest circumference'),
                      type: 'number',
                      min: concepts.chestCircumferenceRange?.lowAbsolute,
                      max: concepts.chestCircumferenceRange?.hiAbsolute,
                      id: 'chestCircumference',
                    },
                  ]}
                  interpretation={
                    chestCircumference != null &&
                    assessValue(chestCircumference, getPatientReferenceRange(config.concepts.chestCircumferenceUuid))
                  }
                  isValueWithinReferenceRange={
                    chestCircumference
                      ? isValueWithinReferenceRange(
                          conceptMetadata,
                          config.concepts['chestCircumferenceUuid'],
                          chestCircumference,
                          getPatientReferenceRange(config.concepts.chestCircumferenceUuid),
                        )
                      : true
                  }
                  showErrorMessage={showErrorMessage}
                  label={t('chestCircumference', 'Chest circumference')}
                  unitSymbol={
                    conceptUnits.get(config.concepts.chestCircumferenceUuid) ??
                    concepts.chestCircumferenceRange?.units ??
                    config.biometrics.chestCircumference.unit
                  }
                />
              </Column>
            )}
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
            subtitle={`${formErrorMessage || t('pleaseFillField', 'Please fill at least one field')}.`}
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
