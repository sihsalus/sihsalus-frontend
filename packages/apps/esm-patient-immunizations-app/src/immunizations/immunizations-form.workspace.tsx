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
import { immunizationEditPrivilege } from '../constants';
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
import { getFhirImmunizationConceptMappings } from './fhir-immunization-config';
import {
  ensureImmunizationEncounterProvider,
  getUnknownEncounterRoleUuid,
} from './immunization-encounter-provider.resource';
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
  const providerUuid = currentUser?.currentProvider?.uuid;
  const unknownEncounterRoleUuid = getUnknownEncounterRoleUuid(config);
  const activeVisitLocationUuid = visitContext?.location?.uuid;
  const isTablet = useLayoutType() === 'tablet';
  const { t } = useTranslation('@sihsalus/esm-patient-immunizations-app');
  const { immunizationsConceptSet } = useImmunizationsConceptSet(config);
  const {
    data: existingImmunizations,
    error: immunizationsError,
    isLoading: isLoadingImmunizations,
    mutate,
  } = useImmunizations(patientUuid);
  const { scheduleData } = useVaccinationSchedule();

  const [immunizationToEditMeta, setImmunizationToEditMeta] = useState<{
    immunizationObsUuid: string;
    persistenceSource?: 'fhir' | 'ampath-form';
    visitUuid?: string;
    locationUuid?: string;
  }>();
  const locationUuid = immunizationToEditMeta?.locationUuid ?? activeVisitLocationUuid;

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
        doseNumber: z.union([z.coerce.number<number>().int().min(1), z.null()]).optional(),
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
  const formProps = useForm<z.input<typeof immunizationFormSchema>, unknown, ImmunizationFormInputData>({
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
          locationUuid: props.locationId,
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
      if (isLoadingImmunizations || immunizationsError) {
        return;
      }
      if (!locationUuid) {
        showSnackbar({
          title: t('errorSaving', 'Error saving vaccination'),
          subtitle: t('activeVisitLocationRequired', 'An active visit with an operational UPSS is required.'),
          kind: 'error',
          isLowContrast: false,
        });
        return;
      }

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
        const isNewImmunization = !immunizationToEditMeta?.immunizationObsUuid;
        const visitUuid = immunizationToEditMeta?.visitUuid || visitContext?.uuid;

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
              visitUuid,
              locationUuid,
              isNewImmunization ? { providerUuid, encounterRoleUuid: unknownEncounterRoleUuid } : undefined,
            ),
            immunizationToEditMeta?.immunizationObsUuid,
            abortController,
          );

        const saveViaFhir = () =>
          savePatientImmunization(
            mapToFHIRImmunizationResource(immunization, visitUuid, locationUuid, providerUuid),
            immunizationToEditMeta?.immunizationObsUuid,
            abortController,
          );

        if (immunizationToEditMeta?.persistenceSource === 'ampath-form') {
          await saveViaAmpathForm();
        } else {
          if (!providerUuid) {
            showSnackbar({
              title: t('errorSaving', 'Error saving vaccination'),
              subtitle: t(
                'providerRequiredForVaccination',
                'Your user account has no provider record. Ask support to assign one before recording vaccinations.',
              ),
              kind: 'error',
              isLowContrast: false,
            });
            return;
          }
          if (isNewImmunization) {
            // FHIR2 reuses the visit's latest vaccination encounter and cannot
            // read it back unless a provider holds the "Unknown" role. This
            // runs before anything is sent, so a failure here means nothing
            // was saved.
            try {
              await ensureImmunizationEncounterProvider({
                patientUuid,
                visitUuid,
                encounterTypeUuid: ampathPersistence.encounterTypeUuid,
                providerUuid,
                encounterRoleUuid: unknownEncounterRoleUuid,
                signal: abortController.signal,
              });
            } catch {
              showSnackbar({
                title: t('errorSaving', 'Error saving vaccination'),
                subtitle: t(
                  'encounterProviderPreflightFailed',
                  'Could not prepare the vaccination encounter. Nothing was saved.',
                ),
                kind: 'error',
                isLowContrast: false,
              });
              return;
            }
          }
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
        const subtitle =
          errorDetails.type === 'missing-fhir-mapping' || errorDetails.type === 'fhir-setup'
            ? t('vaccinationServiceUnavailable', 'Vaccination is unavailable. Contact support before trying again.')
            : t(
                'vaccinationSaveUnconfirmed',
                'The vaccination could not be confirmed as saved. Review the history before trying again.',
              );

        showSnackbar({
          title: t('errorSaving', 'Error saving vaccination'),
          kind: 'error',
          isLowContrast: false,
          subtitle,
        });
      }
    },
    [
      patientUuid,
      immunizationsError,
      isLoadingImmunizations,
      providerUuid,
      unknownEncounterRoleUuid,
      visitContext?.uuid,
      immunizationToEditMeta,
      immunizationsConceptSet,
      locationUuid,
      closeWorkspace,
      t,
      mutate,
      fhirConceptMappings,
      ampathPersistence.enabled,
      ampathPersistence.encounterTypeUuid,
      config,
    ],
  );
  return (
    <Workspace2 title={t('immunizationWorkspaceTitle', 'Immunization')} hasUnsavedChanges={isDirty}>
      <RequirePrivilege privilege={immunizationEditPrivilege}>
        <FormProvider {...formProps}>
          <Form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
            <Stack gap={5} className={styles.container}>
              <p>{t('requiredFieldsHint', 'Fields marked with * are required.')}</p>
              {immunizationsError ? (
                <InlineNotification
                  kind="error"
                  lowContrast
                  hideCloseButton
                  title={t('vaccinationHistoryUnavailable', 'Vaccination history unavailable')}
                  subtitle={t(
                    'vaccinationHistoryRequired',
                    'The vaccination history could not be loaded. Close this form and reload the history before recording a vaccination.',
                  )}
                />
              ) : null}
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
                      labelText={`${t('vaccinationDate', 'Vaccination date')} *`}
                      isRequired
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
                      titleText={`${t('immunization', 'Immunization')} *`}
                      aria-required
                    />
                  )}
                />
              </ResponsiveWrapper>
              {vaccineUuid && (
                <ResponsiveWrapper>
                  <Controller
                    name="doseNumber"
                    control={control}
                    render={({ field, fieldState }) => (
                      <DoseInput
                        vaccine={vaccineUuid}
                        sequences={activeScheduleSequenceDefinitions}
                        field={field}
                        fieldState={fieldState}
                        existingDoseNumbers={existingDoseNumbers}
                        warningMessage={duplicateDoseWarning}
                      />
                    )}
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
                      titleText={`${t('immunizationStatus', 'Estado de aplicación')} *`}
                      aria-required
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
                      titleText={`${t('programContext', 'Contexto MINSA')} *`}
                      aria-required
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
                        labelText={`${t('statusReason', 'Motivo de no aplicación o diferimiento')} *`}
                        required
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
                disabled={isSubmitting || isLoadingImmunizations || !!immunizationsError}
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
