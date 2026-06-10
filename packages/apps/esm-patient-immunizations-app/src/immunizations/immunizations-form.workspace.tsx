import {
  Button,
  ButtonSet,
  Dropdown,
  Form,
  InlineLoading,
  InlineNotification,
  Stack,
  TextArea,
  TextInput,
} from '@carbon/react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  getCoreTranslation,
  OpenmrsDatePicker,
  parseDate,
  ResponsiveWrapper,
  showSnackbar,
  useConfig,
  useLayoutType,
  useSession,
  Workspace2,
} from '@openmrs/esm-framework';
import { type PatientWorkspace2DefinitionProps } from '@openmrs/esm-patient-common-lib';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { type ImmunizationConfigObject } from '../config-schema';
import { credImmunizationEditPrivilege } from '../constants';
import { useImmunizations } from '../hooks/useImmunizations';
import { useImmunizationsConceptSet } from '../hooks/useImmunizationsConceptSet';
import { type ImmunizationFormData } from '../types';
import {
  scheduleEntriesToSequenceDefinitions,
  useVaccinationSchedule,
} from '../vaccine-scheduling-builder/vaccination-schedule.resource';
import { getAmpathImmunizationFormPersistence } from './ampath-form-immunization-config';
import { mapToAmpathImmunizationEncounterPayload } from './ampath-form-immunization-mapper';
import { DoseInput } from './components/dose-input.component';
import { fhirImmunizationConceptMappingLabels, getFhirImmunizationConceptMappings } from './fhir-immunization-config';
import { mapToFHIRImmunizationResource } from './immunization-mapper';
import {
  getImmunizationSaveErrorDetails,
  savePatientImmunization,
  savePatientImmunizationViaAmpathForm,
} from './immunizations.resource';
import styles from './immunizations-form.scss';
import { immunizationFormSub } from './utils';

const ImmunizationsForm: React.FC<PatientWorkspace2DefinitionProps<Record<string, never>, Record<string, never>>> = ({
  closeWorkspace,
  groupProps: { patientUuid, patient, visitContext },
}) => {
  const config = useConfig<ImmunizationConfigObject>();
  const ampathPersistence = getAmpathImmunizationFormPersistence(config);
  const fhirConceptMappings = getFhirImmunizationConceptMappings(config?.fhirConceptMappings);
  const currentUser = useSession();
  const isTablet = useLayoutType() === 'tablet';
  const { t } = useTranslation();
  const { immunizationsConceptSet } = useImmunizationsConceptSet(config);
  const { data: existingImmunizations, isLoading: isLoadingImmunizations, mutate } = useImmunizations(patientUuid);
  const { scheduleData } = useVaccinationSchedule();

  const [immunizationToEditMeta, setImmunizationToEditMeta] = useState<{
    immunizationObsUuid: string;
    persistenceSource?: 'fhir' | 'ampath-form';
    visitUuid?: string;
  }>();

  const immunizationFormSchema = useMemo(() => {
    return z
      .object({
        vaccineUuid: z.string().min(1, t('vaccineRequired', 'Vaccine is required')),
        vaccinationDate: z
          .date()
          .min(new Date(patient.birthDate), {
            message: t('vaccinationDateCannotBeBeforeBirthDate', 'Vaccination date cannot precede birth date'),
          })
          .refine(
            (date) => {
              // Normalize both dates to start of day in local timezone
              const inputDate = dayjs(date).startOf('day');
              const today = dayjs().startOf('day');
              return inputDate.isSame(today) || inputDate.isBefore(today);
            },
            {
              message: t('vaccinationDateCannotBeInTheFuture', 'Vaccination date cannot be in the future'),
            },
          ),
        // null means unset; when provided, must be an integer ≥ 1
        doseNumber: z.union([z.number({ coerce: true }).int().min(1), z.null()]).optional(),
        // FHIR supports not-done immunizations; MINSA workflows need this for
        // missed, deferred or contraindicated doses without deleting the event.
        status: z.enum(['completed', 'not-done']).default('completed'),
        statusReason: z.string().trim().max(255).optional(),
        programContext: z.enum(['routine', 'catch-up', 'campaign', 'special']).default('routine'),
        note: z.string().trim().max(255).optional(),
        nextDoseDate: z.date().nullable().optional(),
        expirationDate: z.date().nullable().optional(),
        lotNumber: z.string().nullable().optional(),
        manufacturer: z.string().nullable().optional(),
      })
      .superRefine((value, ctx) => {
        if (value.status === 'not-done' && !value.statusReason?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['statusReason'],
            message: t('statusReasonRequired', 'Please provide the reason for non-administration or deferral'),
          });
        }
      });
  }, [patient.birthDate, t]);

  type ImmunizationFormInputData = z.infer<typeof immunizationFormSchema>;
  const formProps = useForm<ImmunizationFormInputData>({
    mode: 'all',
    resolver: zodResolver(immunizationFormSchema),
    defaultValues: {
      vaccineUuid: '',
      vaccinationDate: dayjs().startOf('day').toDate(),
      doseNumber: 1,
      status: 'completed',
      statusReason: '',
      programContext: 'routine',
      nextDoseDate: null,
      note: '',
      expirationDate: null,
      lotNumber: '',
      manufacturer: '',
    },
  });

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isDirty, isSubmitting },
    watch,
  } = formProps;
  const vaccinationDate = watch('vaccinationDate');
  const vaccineUuid = watch('vaccineUuid');
  const doseNumber = watch('doseNumber');
  const immunizationStatus = watch('status');
  const activeScheduleSequenceDefinitions = useMemo(() => {
    const scheduleSequences = scheduleEntriesToSequenceDefinitions(scheduleData);
    return scheduleSequences.length ? scheduleSequences : config.sequenceDefinitions;
  }, [config.sequenceDefinitions, scheduleData]);

  const duplicateDoseWarning = useMemo(() => {
    if (!vaccineUuid || doseNumber == null) return undefined;

    const isDuplicate = existingImmunizations?.some((group) => {
      if (group.vaccineUuid !== vaccineUuid) {
        return false;
      }

      return group.existingDoses.some(
        (dose) =>
          dose.doseNumber != null &&
          Number(dose.doseNumber) === Number(doseNumber) &&
          dose.immunizationObsUuid !== immunizationToEditMeta?.immunizationObsUuid,
      );
    });

    return isDuplicate
      ? t('duplicateDoseWarning', 'Dose {{dose}} has already been recorded for this vaccine', { dose: doseNumber })
      : undefined;
  }, [doseNumber, existingImmunizations, immunizationToEditMeta?.immunizationObsUuid, t, vaccineUuid]);

  const selectedSequence = useMemo(() => {
    if (!vaccineUuid || doseNumber == null) return null;

    return activeScheduleSequenceDefinitions
      .find((sequence) => sequence.vaccineConceptUuid === vaccineUuid)
      ?.sequences.find((sequence) => sequence.sequenceNumber === doseNumber);
  }, [activeScheduleSequenceDefinitions, doseNumber, vaccineUuid]);

  const minsaAgeWarning = useMemo(() => {
    if (!selectedSequence || !vaccinationDate || !patient.birthDate) return null;

    // Age limits are warnings, not blockers. MINSA allows rescue schedules,
    // campaigns and special indications that still need clinical validation.
    const ageInDays = dayjs(vaccinationDate).startOf('day').diff(dayjs(patient.birthDate).startOf('day'), 'day');
    const minAge = selectedSequence.minAgeInDays;
    const maxAge = selectedSequence.maxAgeInDays;

    if (typeof minAge === 'number' && ageInDays < minAge) {
      return t(
        'minsaMinimumAgeWarning',
        'La fecha seleccionada está antes de la edad recomendada por MINSA para esta dosis{{label}}.',
        {
          label: selectedSequence.minsaLabel ? ` (${selectedSequence.minsaLabel})` : '',
        },
      );
    }

    if (typeof maxAge === 'number' && ageInDays > maxAge) {
      return t(
        'minsaMaximumAgeWarning',
        'La fecha seleccionada está después de la edad recomendada por MINSA para esta dosis{{label}}. Verifique si corresponde a rescate, campaña o indicación especial.',
        {
          label: selectedSequence.minsaLabel ? ` (${selectedSequence.minsaLabel})` : '',
        },
      );
    }

    return null;
  }, [patient.birthDate, selectedSequence, t, vaccinationDate]);

  useEffect(() => {
    const sub = immunizationFormSub.subscribe((props) => {
      if (props) {
        const vaccinationDateOrNow = props.vaccinationDate ? parseDate(props.vaccinationDate) : new Date();
        reset({
          vaccineUuid: props.vaccineUuid,
          vaccinationDate: vaccinationDateOrNow,
          doseNumber: props.doseNumber,
          status: props.status === 'not-done' ? 'not-done' : 'completed',
          statusReason: props.statusReason,
          // Older records do not have the SIH.SALUS MINSA context extension;
          // treat them as routine so editing remains backward compatible.
          programContext:
            props.programContext === 'campaign' ||
            props.programContext === 'catch-up' ||
            props.programContext === 'special'
              ? props.programContext
              : 'routine',
          nextDoseDate: props.nextDoseDate ? parseDate(props.nextDoseDate) : null,
          note: props.note,
          expirationDate: props.expirationDate ? parseDate(props.expirationDate) : null,
          lotNumber: props.lotNumber,
          manufacturer: props.manufacturer,
        });
        setImmunizationToEditMeta({
          immunizationObsUuid: props.immunizationId,
          persistenceSource: props.persistenceSource,
          visitUuid: props.visitId,
        });
      }
    });

    return () => {
      sub.unsubscribe();
      immunizationFormSub.next(null);
    };
  }, [reset]);

  useEffect(() => {
    if (!vaccineUuid || doseNumber == null || !vaccinationDate) return;

    const sequenceDefinition = activeScheduleSequenceDefinitions.find(
      (sequence) => sequence.vaccineConceptUuid === vaccineUuid,
    );
    if (!sequenceDefinition) return;

    const currentIndex = sequenceDefinition.sequences.findIndex((sequence) => sequence.sequenceNumber === doseNumber);
    const nextSequence = currentIndex >= 0 ? sequenceDefinition.sequences[currentIndex + 1] : undefined;

    if (nextSequence?.intervalInDaysAfterPreviousDose) {
      setValue(
        'nextDoseDate',
        dayjs(vaccinationDate).add(nextSequence.intervalInDaysAfterPreviousDose, 'day').toDate(),
        {
          shouldDirty: false,
        },
      );
    }
  }, [activeScheduleSequenceDefinitions, doseNumber, setValue, vaccinationDate, vaccineUuid]);

  const existingDoseNumbers = useMemo(() => {
    const immunization = existingImmunizations?.find((candidate) => candidate.vaccineUuid === vaccineUuid);
    return immunization?.existingDoses.map((dose) => dose.doseNumber) ?? [];
  }, [existingImmunizations, vaccineUuid]);

  const onSubmit = useCallback(
    async (data: ImmunizationFormInputData) => {
      try {
        const {
          vaccineUuid,
          vaccinationDate,
          doseNumber,
          status,
          statusReason,
          programContext,
          expirationDate,
          lotNumber,
          manufacturer,
          note,
          nextDoseDate,
        } = data;
        const abortController = new AbortController();

        const immunization: ImmunizationFormData = {
          patientUuid,
          immunizationId: immunizationToEditMeta?.immunizationObsUuid,
          vaccineName: immunizationsConceptSet.answers.find((answer) => answer.uuid === vaccineUuid)?.display ?? '',
          vaccineUuid: vaccineUuid,
          vaccinationDate: dayjs(vaccinationDate).startOf('day').toDate().toISOString(),
          doseNumber,
          status,
          statusReason,
          programContext,
          nextDoseDate: nextDoseDate ? dayjs(nextDoseDate).startOf('day').toDate().toISOString() : null,
          note,
          expirationDate: expirationDate ? dayjs(expirationDate).format('YYYY-MM-DD') : null,
          lotNumber,
          manufacturer,
        };

        const saveViaAmpathForm = () =>
          savePatientImmunizationViaAmpathForm(
            mapToAmpathImmunizationEncounterPayload(
              immunization,
              config,
              immunizationToEditMeta?.visitUuid || visitContext?.uuid,
              currentUser?.sessionLocation?.uuid,
            ),
            immunizationToEditMeta?.immunizationObsUuid,
            abortController,
          );

        const saveViaFhir = () =>
          savePatientImmunization(
            mapToFHIRImmunizationResource(
              immunization,
              immunizationToEditMeta?.visitUuid || visitContext?.uuid,
              currentUser?.sessionLocation?.uuid,
              currentUser?.currentProvider?.uuid,
            ),
            immunizationToEditMeta?.immunizationObsUuid,
            abortController,
          );

        if (immunizationToEditMeta?.persistenceSource === 'ampath-form') {
          await saveViaAmpathForm();
        } else {
          try {
            await saveViaFhir();
          } catch (err) {
            const errorDetails = getImmunizationSaveErrorDetails(err, fhirConceptMappings);
            const canFallbackToAmpath =
              !immunizationToEditMeta?.immunizationObsUuid &&
              ampathPersistence.enabled &&
              errorDetails.type === 'fhir-setup';

            if (!canFallbackToAmpath) {
              throw err;
            }

            await saveViaAmpathForm();
          }
        }
        closeWorkspace({ discardUnsavedChanges: true });
        mutate();
        showSnackbar({
          kind: 'success',
          title: t('vaccinationSaved', 'Vaccination saved successfully'),
          isLowContrast: true,
        });
      } catch (err) {
        const errorDetails = getImmunizationSaveErrorDetails(err, fhirConceptMappings);
        const configKeyLabel =
          errorDetails.type === 'missing-fhir-mapping' && errorDetails.configKey
            ? fhirImmunizationConceptMappingLabels[errorDetails.configKey]
            : undefined;
        const subtitle =
          errorDetails.type === 'missing-fhir-mapping'
            ? t(
                'fhirImmunizationMissingMapping',
                'FHIR immunization setup is incomplete. No unique concept is mapped to {{mapping}}{{configKey}}. Update sihsalus-content and reload backend content.',
                {
                  mapping: errorDetails.mapping,
                  configKey: configKeyLabel ? ` (${configKeyLabel})` : '',
                },
              )
            : errorDetails.type === 'fhir-setup'
              ? t(
                  'fhirImmunizationSetupError',
                  'FHIR immunization setup is incomplete. Update sihsalus-content and reload backend content.',
                )
              : errorDetails.type === 'validation'
                ? (errorDetails.diagnostics ?? t('invalidVaccinationRequest', 'The vaccination request is invalid.'))
                : (errorDetails.message ?? t('unknownVaccinationSaveError', 'Unknown error while saving vaccination.'));

        showSnackbar({
          title: t('errorSaving', 'Error saving vaccination'),
          kind: 'error',
          isLowContrast: false,
          subtitle,
        });
      }
    },
    [
      currentUser?.sessionLocation?.uuid,
      patientUuid,
      currentUser?.currentProvider?.uuid,
      visitContext?.uuid,
      immunizationToEditMeta,
      immunizationsConceptSet,
      closeWorkspace,
      t,
      mutate,
      fhirConceptMappings,
      ampathPersistence.enabled,
      config,
    ],
  );
  return (
    <Workspace2 title={t('immunizationWorkspaceTitle', 'Immunization')} hasUnsavedChanges={isDirty}>
      <RequirePrivilege privilege={credImmunizationEditPrivilege}>
        <FormProvider {...formProps}>
          <Form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
            <Stack gap={5} className={styles.container}>
              <ResponsiveWrapper>
                <Controller
                  name="vaccinationDate"
                  control={control}
                  render={({ field, fieldState }) => (
                    <OpenmrsDatePicker
                      {...field}
                      className={styles.datePicker}
                      id="vaccinationDate"
                      invalid={Boolean(fieldState?.error?.message)}
                      invalidText={fieldState?.error?.message}
                      labelText={t('vaccinationDate', 'Vaccination date')}
                      maxDate={new Date()}
                    />
                  )}
                />
              </ResponsiveWrapper>
              <ResponsiveWrapper>
                <Controller
                  name="vaccineUuid"
                  control={control}
                  render={({ field: { onChange, value } }) => (
                    <Dropdown
                      disabled={!!immunizationToEditMeta}
                      id="immunization"
                      invalid={!!errors?.vaccineUuid}
                      invalidText={errors?.vaccineUuid?.message}
                      itemToString={(item) =>
                        immunizationsConceptSet?.answers.find((candidate) => candidate.uuid === item)?.display
                      }
                      items={immunizationsConceptSet?.answers?.map((item) => item.uuid) || []}
                      label={t('selectImmunization', 'Select immunization')}
                      onChange={(val) => onChange(val.selectedItem)}
                      selectedItem={value}
                      titleText={t('immunization', 'Immunization')}
                    />
                  )}
                />
              </ResponsiveWrapper>
              {vaccineUuid && (
                <ResponsiveWrapper>
                  <DoseInput
                    vaccine={vaccineUuid}
                    sequences={activeScheduleSequenceDefinitions}
                    control={control}
                    existingDoseNumbers={existingDoseNumbers}
                    warningMessage={duplicateDoseWarning}
                  />
                </ResponsiveWrapper>
              )}
              <ResponsiveWrapper>
                <Controller
                  name="status"
                  control={control}
                  render={({ field: { onChange, value } }) => (
                    <Dropdown
                      id="immunizationStatus"
                      itemToString={(item) =>
                        item === 'not-done'
                          ? t('notAdministered', 'No aplicada / diferida')
                          : t('administered', 'Aplicada')
                      }
                      items={['completed', 'not-done']}
                      label={t('selectStatus', 'Seleccione estado')}
                      onChange={(val) => onChange(val.selectedItem)}
                      selectedItem={value}
                      titleText={t('immunizationStatus', 'Estado de aplicación')}
                    />
                  )}
                />
              </ResponsiveWrapper>
              <ResponsiveWrapper>
                <Controller
                  name="programContext"
                  control={control}
                  render={({ field: { onChange, value } }) => (
                    <Dropdown
                      id="programContext"
                      itemToString={(item) =>
                        ({
                          routine: t('routineSchedule', 'Esquema regular'),
                          'catch-up': t('catchUpSchedule', 'Rescate'),
                          campaign: t('campaignSchedule', 'Campaña o barrido'),
                          special: t('specialIndication', 'Indicación especial'),
                        })[item] ?? item
                      }
                      items={['routine', 'catch-up', 'campaign', 'special']}
                      label={t('selectProgramContext', 'Seleccione contexto')}
                      onChange={(val) => onChange(val.selectedItem)}
                      selectedItem={value}
                      titleText={t('programContext', 'Contexto MINSA')}
                    />
                  )}
                />
              </ResponsiveWrapper>
              {immunizationStatus === 'not-done' ? (
                <ResponsiveWrapper>
                  <Controller
                    name="statusReason"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        id="statusReason"
                        invalid={!!errors?.statusReason}
                        invalidText={errors?.statusReason?.message}
                        labelText={t('statusReason', 'Motivo de no aplicación o diferimiento')}
                        onChange={(evt) => onChange(evt.target.value)}
                        type="text"
                        value={value}
                      />
                    )}
                  />
                </ResponsiveWrapper>
              ) : null}
              {minsaAgeWarning ? (
                <InlineNotification
                  kind="warning"
                  lowContrast
                  title={t('minsaScheduleWarning', 'Advertencia de esquema MINSA')}
                  subtitle={minsaAgeWarning}
                />
              ) : null}
              <div className={styles.vaccineBatchHeading}>
                {t('vaccineBatchInformation', 'Vaccine Batch Information')}
              </div>
              <ResponsiveWrapper>
                <Controller
                  name="manufacturer"
                  control={control}
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      id="manufacturer"
                      labelText={t('manufacturer', 'Manufacturer')}
                      onChange={(evt) => onChange(evt.target.value)}
                      type="text"
                      value={value}
                    />
                  )}
                />
              </ResponsiveWrapper>
              <ResponsiveWrapper>
                <Controller
                  name="lotNumber"
                  control={control}
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      id="lotNumber"
                      labelText={t('lotNumber', 'Lot Number')}
                      onChange={(evt) => onChange(evt.target.value)}
                      type="text"
                      value={value}
                    />
                  )}
                />
              </ResponsiveWrapper>
              <ResponsiveWrapper>
                <Controller
                  name="expirationDate"
                  control={control}
                  render={({ field, fieldState }) => (
                    <OpenmrsDatePicker
                      {...field}
                      className={styles.datePicker}
                      id="vaccinationExpiration"
                      invalid={Boolean(fieldState?.error?.message)}
                      invalidText={fieldState?.error?.message}
                      labelText={t('expirationDate', 'Expiration date')}
                      minDate={vaccinationDate}
                    />
                  )}
                />
              </ResponsiveWrapper>
              <ResponsiveWrapper>
                <Controller
                  name="note"
                  control={control}
                  render={({ field: { onChange, value } }) => (
                    <TextArea
                      enableCounter
                      id="note"
                      invalidText={errors?.note?.message}
                      labelText={t('note', 'Note')}
                      maxCount={255}
                      onChange={(evt) => onChange(evt.target.value)}
                      placeholder={t('immunizationNotePlaceholder', 'For example: mild redness at injection site')}
                      value={value}
                    />
                  )}
                />
              </ResponsiveWrapper>
              <ResponsiveWrapper>
                <Controller
                  name="nextDoseDate"
                  control={control}
                  render={({ field, fieldState }) => (
                    <OpenmrsDatePicker
                      {...field}
                      className={styles.datePicker}
                      id="nextDoseDate"
                      invalid={Boolean(fieldState?.error?.message)}
                      invalidText={fieldState?.error?.message}
                      labelText={t('nextDoseDate', 'Next dose date')}
                      minDate={vaccinationDate}
                    />
                  )}
                />
              </ResponsiveWrapper>
            </Stack>
            <ButtonSet className={isTablet ? styles.tablet : styles.desktop}>
              <Button className={styles.button} kind="secondary" onClick={() => closeWorkspace()}>
                {getCoreTranslation('cancel')}
              </Button>
              <Button
                className={styles.button}
                kind="primary"
                disabled={isSubmitting || isLoadingImmunizations}
                type="submit"
              >
                {isSubmitting ? (
                  <InlineLoading className={styles.spinner} description={t('saving', 'Saving') + '...'} />
                ) : (
                  <span>{getCoreTranslation('save')}</span>
                )}
              </Button>
            </ButtonSet>
          </Form>
        </FormProvider>
      </RequirePrivilege>
    </Workspace2>
  );
};

export default ImmunizationsForm;
