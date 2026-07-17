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
  getUserFacingErrorMessage as frameworkGetUserFacingErrorMessage,
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
import { getCompatibleUserFacingErrorMessage } from '@openmrs/esm-utils';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import type { ConfigObject, GlasgowComaScaleAnswerUuids } from '../config-schema';

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

// The scores are intrinsic to the Glasgow Coma Scale; only the concept answer UUIDs
// vary per installation and come from config (vitals.glasgowComaScale.answerUuids).
const GLASGOW_SCORE_BY_ANSWER_KEY: Record<keyof GlasgowComaScaleAnswerUuids, number | undefined> = {
  eyeOpeningSpontaneous: 4,
  eyeOpeningToSpeech: 3,
  eyeOpeningToPain: 2,
  eyeOpeningNone: 1,
  eyeOpeningNotTestable: undefined,
  verbalResponseOriented: 5,
  verbalResponseConfused: 4,
  verbalResponseInappropriateWords: 3,
  verbalResponseIncomprehensibleSounds: 2,
  verbalResponseNone: 1,
  verbalResponseNotTestable: undefined,
  motorResponseObeysCommands: 6,
  motorResponseLocalizesPain: 5,
  motorResponseWithdrawsFromPain: 4,
  motorResponseAbnormalFlexion: 3,
  motorResponseExtension: 2,
  motorResponseNone: 1,
  motorResponseNotTestable: undefined,
};

function buildGlasgowScoreByAnswerUuid(answerUuids: GlasgowComaScaleAnswerUuids): Record<string, number | undefined> {
  return Object.fromEntries(
    Object.entries(GLASGOW_SCORE_BY_ANSWER_KEY).map(([key, score]) => [
      answerUuids[key as keyof GlasgowComaScaleAnswerUuids],
      score,
    ]),
  );
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
  .refine((fields) => (fields.systolicBloodPressure == null) === (fields.diastolicBloodPressure == null), {
    message: 'Blood pressure requires both systolic and diastolic values',
    path: ['bloodPressureIncomplete'],
  })
  .refine(
    (fields) => {
      // A note alone must not create an encounter; require at least one measurement
      const {
        generalPatientNote: _note,
        computedBodyMassIndex: _bmi,
        glasgowTotal: _glasgowTotal,
        ...measurements
      } = fields;
      return Object.values(measurements).some((value) => value != null && value !== '');
    },
    {
      message: 'Please record at least one measurement',
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
  locationUuid?: string;
  patientUuid?: string;
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
  const patientUuid = isWorkspace2Props(props)
    ? (props.groupProps?.patientUuid ?? props.workspaceProps?.patientUuid ?? '')
    : props.patientUuid;
  const isTablet = useLayoutType() === 'tablet';
  const config = useConfig<ConfigObject>();
  const biometricsUnitsSymbols = config.biometrics;
  const useMuacColorStatus = config.vitals.useMuacColors;

  // The session is used only to attribute the provider; the encounter location
  // comes from the visit (or an explicit workspace override), never from the session.
  const session = useSession();
  const patient = usePatient(patientUuid);
  const { currentVisit } = useVisitOrOfflineVisit(patientUuid);
  const {
    data: conceptUnits,
    conceptMetadata,
    conceptRanges,
    isLoading,
    error: conceptMetadataError,
  } = useVitalsConceptMetadata();
  // With no concept metadata every range check silently passes; the form still
  // allows saving, but the user must know the values are not being validated.
  const referenceRangesUnavailable = Boolean(conceptMetadataError) || (!isLoading && !conceptMetadata?.length);
  const referenceRangeConceptUuids = useMemo(
    () => [
      config.concepts.temperatureUuid,
      config.concepts.weightUuid,
      config.concepts.heightUuid,
      config.concepts.midUpperArmCircumferenceUuid,
      config.concepts.abdominalCircumferenceUuid,
      config.concepts.headCircumferenceUuid,
      config.concepts.chestCircumferenceUuid,
      config.concepts.systolicBloodPressureUuid,
      config.concepts.diastolicBloodPressureUuid,
      config.concepts.pulseUuid,
      config.concepts.respiratoryRateUuid,
      config.concepts.oxygenSaturationUuid,
    ],
    [
      config.concepts.temperatureUuid,
      config.concepts.weightUuid,
      config.concepts.heightUuid,
      config.concepts.midUpperArmCircumferenceUuid,
      config.concepts.abdominalCircumferenceUuid,
      config.concepts.headCircumferenceUuid,
      config.concepts.chestCircumferenceUuid,
      config.concepts.systolicBloodPressureUuid,
      config.concepts.diastolicBloodPressureUuid,
      config.concepts.pulseUuid,
      config.concepts.respiratoryRateUuid,
      config.concepts.oxygenSaturationUuid,
    ],
  );
  const { ranges: patientReferenceRanges, isLoading: isLoadingReferenceRanges } = useReferenceRanges(
    patientUuid,
    referenceRangeConceptUuids,
  );
  const [outOfRangeFieldKeys, setOutOfRangeFieldKeys] = useState<Array<string>>([]);
  const confirmedOutOfRangeTokenRef = useRef<string | null>(null);
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

  const glasgowAnswerUuids = config.vitals.glasgowComaScale.answerUuids;
  const glasgowScoreByAnswerUuid = useMemo(
    () => buildGlasgowScoreByAnswerUuid(glasgowAnswerUuids),
    [glasgowAnswerUuids],
  );
  const getGlasgowScore = useCallback(
    (value: string | undefined) => (value ? glasgowScoreByAnswerUuid[value] : undefined),
    [glasgowScoreByAnswerUuid],
  );

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
  }, [getGlasgowScore, glasgowEyeOpening, glasgowMotorResponse, glasgowVerbalResponse, setValue]);

  function onError(err: Record<string, { message?: string }>) {
    if (err?.oneFieldRequired) {
      setShowErrorMessage(false);
      setFormErrorMessage(
        t('atLeastOneMeasurementRequired', 'Please record at least one measurement. A note alone cannot be saved'),
      );
      setShowErrorNotification(true);
      return;
    }

    if (err?.bloodPressureIncomplete) {
      setShowErrorMessage(false);
      setFormErrorMessage(t('bloodPressureIncomplete', 'Blood pressure requires both systolic and diastolic values'));
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
    async (data: VitalsBiometricsFormData) => {
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
      setShowErrorNotification(false);
      setFormErrorMessage('');

      const outOfRangeEntries = Object.entries(formData)
        .filter(([, value]) => value != null && value !== '')
        .filter(([key, value]) => {
          const conceptUuid = config.concepts[`${key}Uuid`];
          if (!conceptUuid) {
            return false;
          }
          return !isValueWithinReferenceRange(
            conceptMetadata,
            conceptUuid,
            value,
            getPatientReferenceRange(conceptUuid),
          );
        });

      // Pathological values must remain recordable: values outside the absolute range
      // warn and require pressing save a second time instead of being rejected.
      const outOfRangeToken = JSON.stringify(outOfRangeEntries);
      if (outOfRangeEntries.length > 0 && confirmedOutOfRangeTokenRef.current !== outOfRangeToken) {
        confirmedOutOfRangeTokenRef.current = outOfRangeToken;
        setOutOfRangeFieldKeys(outOfRangeEntries.map(([key]) => key));
        setShowErrorMessage(true);
        return;
      }

      confirmedOutOfRangeTokenRef.current = null;
      setOutOfRangeFieldKeys([]);
      setShowErrorMessage(false);

      if (!currentVisit?.uuid || currentVisit.stopDatetime) {
        showSnackbar({
          title: t('vitalsAndBiometricsSaveError', 'Error saving vitals and biometrics'),
          kind: 'error',
          isLowContrast: false,
          subtitle: t('noActiveVisit', 'An active visit is required to record vitals and biometrics.'),
        });
        return;
      }

      const locationUuid = workspaceOverrides.locationUuid ?? currentVisit.location?.uuid;
      if (!locationUuid) {
        showSnackbar({
          title: t('vitalsAndBiometricsSaveError', 'Error saving vitals and biometrics'),
          kind: 'error',
          isLowContrast: false,
          subtitle: t('noVisitLocation', 'Could not determine the active visit location.'),
        });
        return;
      }

      const abortController = new AbortController();

      try {
        const response = await savePatientVitals(
          encounterTypeUuid,
          config.concepts,
          patientUuid,
          formData,
          abortController,
          locationUuid,
          currentVisit.uuid,
          {
            encounterDatetime: new Date(),
            providerUuid: session?.currentProvider?.uuid,
            encounterRoleUuid: config.vitals.encounterRoleUuid,
          },
        );

        if (response.status === 201 || response.status === 200) {
          await workspaceOverrides.onVitalsSaved?.({
            encounterTypeUuid,
            formData,
            patientUuid,
            visitUuid: currentVisit.uuid,
          });
          invalidateCachedVitalsAndBiometrics();
          await closeCurrentWorkspaceWithSavedChanges();
          showSnackbar({
            isLowContrast: true,
            kind: 'success',
            title: t('vitalsAndBiometricsRecorded', 'Vitals and Biometrics saved'),
            subtitle: t('vitalsAndBiometricsNowAvailable', 'They are now visible on the Vitals and Biometrics page'),
          });
        }
      } catch (error) {
        createErrorHandler()(error);
        showSnackbar({
          title: t('vitalsAndBiometricsSaveError', 'Error saving vitals and biometrics'),
          kind: 'error',
          isLowContrast: false,
          subtitle: getCompatibleUserFacingErrorMessage(
            error,
            t('unexpectedError', 'An unexpected error occurred. Please try again.'),
            { logContext: 'Save vitals and biometrics' },
            frameworkGetUserFacingErrorMessage,
          ),
        });
      }
    },
    [
      closeCurrentWorkspaceWithSavedChanges,
      conceptMetadata,
      config.concepts,
      config.vitals.encounterRoleUuid,
      currentVisit?.location?.uuid,
      currentVisit?.stopDatetime,
      currentVisit?.uuid,
      encounterTypeUuid,
      getGlasgowScore,
      getPatientReferenceRange,
      patientUuid,
      session?.currentProvider?.uuid,
      t,
      workspaceOverrides,
    ],
  );

  const glasgowEyeOpeningOptions = useMemo<Array<GlasgowComaScaleOption>>(
    () => [
      {
        value: glasgowAnswerUuids.eyeOpeningSpontaneous,
        score: 4,
        label: t('glasgowEyeOpeningSpontaneous', '4 - Spontaneous'),
      },
      {
        value: glasgowAnswerUuids.eyeOpeningToSpeech,
        score: 3,
        label: t('glasgowEyeOpeningToSpeech', '3 - To speech'),
      },
      {
        value: glasgowAnswerUuids.eyeOpeningToPain,
        score: 2,
        label: t('glasgowEyeOpeningToPain', '2 - To pain'),
      },
      {
        value: glasgowAnswerUuids.eyeOpeningNone,
        score: 1,
        label: t('glasgowEyeOpeningNone', '1 - None'),
      },
      {
        value: glasgowAnswerUuids.eyeOpeningNotTestable,
        label: t('glasgowEyeOpeningNotTestable', 'Not testable'),
      },
    ],
    [glasgowAnswerUuids, t],
  );

  const glasgowVerbalResponseOptions = useMemo<Array<GlasgowComaScaleOption>>(
    () => [
      {
        value: glasgowAnswerUuids.verbalResponseOriented,
        score: 5,
        label: t('glasgowVerbalResponseOriented', '5 - Oriented'),
      },
      {
        value: glasgowAnswerUuids.verbalResponseConfused,
        score: 4,
        label: t('glasgowVerbalResponseConfused', '4 - Confused'),
      },
      {
        value: glasgowAnswerUuids.verbalResponseInappropriateWords,
        score: 3,
        label: t('glasgowVerbalResponseInappropriateWords', '3 - Inappropriate words'),
      },
      {
        value: glasgowAnswerUuids.verbalResponseIncomprehensibleSounds,
        score: 2,
        label: t('glasgowVerbalResponseIncomprehensibleSounds', '2 - Incomprehensible sounds'),
      },
      {
        value: glasgowAnswerUuids.verbalResponseNone,
        score: 1,
        label: t('glasgowVerbalResponseNone', '1 - None'),
      },
      {
        value: glasgowAnswerUuids.verbalResponseNotTestable,
        label: t('glasgowVerbalResponseNotTestable', 'Not testable'),
      },
    ],
    [glasgowAnswerUuids, t],
  );

  const glasgowMotorResponseOptions = useMemo<Array<GlasgowComaScaleOption>>(
    () => [
      {
        value: glasgowAnswerUuids.motorResponseObeysCommands,
        score: 6,
        label: t('glasgowMotorResponseObeysCommands', '6 - Obeys commands'),
      },
      {
        value: glasgowAnswerUuids.motorResponseLocalizesPain,
        score: 5,
        label: t('glasgowMotorResponseLocalizesPain', '5 - Localizes pain'),
      },
      {
        value: glasgowAnswerUuids.motorResponseWithdrawsFromPain,
        score: 4,
        label: t('glasgowMotorResponseWithdrawsFromPain', '4 - Withdraws from pain'),
      },
      {
        value: glasgowAnswerUuids.motorResponseAbnormalFlexion,
        score: 3,
        label: t('glasgowMotorResponseAbnormalFlexion', '3 - Abnormal flexion'),
      },
      {
        value: glasgowAnswerUuids.motorResponseExtension,
        score: 2,
        label: t('glasgowMotorResponseExtension', '2 - Extension'),
      },
      {
        value: glasgowAnswerUuids.motorResponseNone,
        score: 1,
        label: t('glasgowMotorResponseNone', '1 - None'),
      },
      {
        value: glasgowAnswerUuids.motorResponseNotTestable,
        label: t('glasgowMotorResponseNotTestable', 'Not testable'),
      },
    ],
    [glasgowAnswerUuids, t],
  );

  const vitalsFieldLabels: Record<string, string> = useMemo(
    () => ({
      systolicBloodPressure: t('systolic', 'systolic'),
      diastolicBloodPressure: t('diastolic', 'diastolic'),
      respiratoryRate: t('respirationRate', 'Respiration rate'),
      oxygenSaturation: t('spo2', 'SpO2'),
      pulse: t('heartRate', 'Heart rate'),
      temperature: t('temperature', 'Temperature'),
      weight: t('weight', 'Weight'),
      height: t('height', 'Height'),
      midUpperArmCircumference: t('muac', 'MUAC'),
      abdominalCircumference: t('abdominalCircumference', 'Abdominal circumference'),
      headCircumference: t('headCircumference', 'Head circumference'),
      chestCircumference: t('chestCircumference', 'Chest circumference'),
      glasgowTotal: t('glasgowTotal', 'Glasgow total'),
    }),
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
      {referenceRangesUnavailable && (
        <Column className={styles.errorContainer}>
          <InlineNotification
            kind="warning"
            lowContrast
            hideCloseButton
            title={t('referenceRangesUnavailable', 'Reference ranges could not be loaded')}
            subtitle={t(
              'referenceRangesUnavailableSubtitle',
              'Values will be recorded without range validation or abnormal-value flags. Verify them carefully.',
            )}
          />
        </Column>
      )}
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
                    assessValue(
                      systolicBloodPressure,
                      getPatientReferenceRange(config.concepts.systolicBloodPressureUuid),
                    ),
                    assessValue(
                      diastolicBloodPressure,
                      getPatientReferenceRange(config.concepts.diastolicBloodPressureUuid),
                    ),
                  )
                }
                isValueWithinReferenceRange={
                  systolicBloodPressure != null &&
                  diastolicBloodPressure != null &&
                  isValueWithinReferenceRange(
                    conceptMetadata,
                    config.concepts.systolicBloodPressureUuid,
                    systolicBloodPressure,
                    getPatientReferenceRange(config.concepts.systolicBloodPressureUuid),
                  ) &&
                  isValueWithinReferenceRange(
                    conceptMetadata,
                    config.concepts.diastolicBloodPressureUuid,
                    diastolicBloodPressure,
                    getPatientReferenceRange(config.concepts.diastolicBloodPressureUuid),
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
                  pulse != null && assessValue(pulse, getPatientReferenceRange(config.concepts.pulseUuid))
                }
                isValueWithinReferenceRange={
                  pulse != null &&
                  isValueWithinReferenceRange(
                    conceptMetadata,
                    config.concepts.pulseUuid,
                    pulse,
                    getPatientReferenceRange(config.concepts.pulseUuid),
                  )
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
                  assessValue(respiratoryRate, getPatientReferenceRange(config.concepts.respiratoryRateUuid))
                }
                isValueWithinReferenceRange={
                  respiratoryRate != null &&
                  isValueWithinReferenceRange(
                    conceptMetadata,
                    config.concepts.respiratoryRateUuid,
                    respiratoryRate,
                    getPatientReferenceRange(config.concepts.respiratoryRateUuid),
                  )
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
                  assessValue(oxygenSaturation, getPatientReferenceRange(config.concepts.oxygenSaturationUuid))
                }
                isValueWithinReferenceRange={
                  oxygenSaturation != null &&
                  isValueWithinReferenceRange(
                    conceptMetadata,
                    config.concepts.oxygenSaturationUuid,
                    oxygenSaturation,
                    getPatientReferenceRange(config.concepts.oxygenSaturationUuid),
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

      {outOfRangeFieldKeys.length > 0 && (
        <Column className={styles.errorContainer}>
          <InlineNotification
            className={styles.errorNotification}
            kind="warning"
            lowContrast={false}
            onClose={() => setOutOfRangeFieldKeys([])}
            title={t('valuesOutOfRangeTitle', 'Values outside the expected range')}
            subtitle={t(
              'valuesOutOfRangeConfirm',
              'Review the following values: {{fields}}. If they are correct, press "Save and close" again to record them.',
              {
                fields: outOfRangeFieldKeys.map((key) => vitalsFieldLabels[key] ?? key).join(', '),
              },
            )}
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
