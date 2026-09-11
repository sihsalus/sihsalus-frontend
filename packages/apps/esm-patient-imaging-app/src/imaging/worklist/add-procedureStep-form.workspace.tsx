import {
  Button,
  ButtonSet,
  ComboBox,
  Form,
  FormGroup,
  InlineLoading,
  SelectItem,
  Stack,
  TextArea,
  TextInput,
  TimePicker,
  TimePickerSelect,
} from '@carbon/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { OpenmrsDatePicker, ResponsiveWrapper, showSnackbar, useLayoutType } from '@openmrs/esm-framework';
import { type amPm, type DefaultPatientWorkspaceProps } from '@openmrs/esm-patient-common-lib';
import React, { useCallback, useEffect, useMemo } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { saveRequestProcedureStep, useProcedureStep, useRequestsByPatient } from '../../api';
import { type CreateRequestProcedureStep, modalityOptions, type RequestProcedure } from '../../types';
import { toDicomDate, toDicomTimeString } from '../utils/help';
import { useImagingOperation } from '../utils/use-imaging-operation';
import styles from './worklist.scss';

export interface AddNewProcedureStepWorkspaceProps extends DefaultPatientWorkspaceProps {
  request: RequestProcedure;
}

const AddNewProcedureStepWorkspace: React.FC<AddNewProcedureStepWorkspaceProps> = ({
  patientUuid,
  request,
  closeWorkspace,
  closeWorkspaceWithSavedChanges,
  promptBeforeClosing,
}) => {
  const { t } = useTranslation();
  const { start, isCurrent, finish, isPending, canWrite } = useImagingOperation(`${patientUuid}:${request.id}`);
  const isTablet = useLayoutType() === 'tablet';
  const { mutate } = useProcedureStep(request.id);
  const { mutate: requestMutate } = useRequestsByPatient(patientUuid);

  const procedureStepFormSchema = useMemo(() => {
    return z.object({
      modality: z
        .string()
        .trim()
        .refine((value) => modalityOptions.some((option) => option.code === value), {
          message: t('modalityRequiredWarn', 'Modality is required'),
        }),
      aetTitle: z
        .string()
        .trim()
        .min(1, { message: t('aetTitleWarn', 'AET title is required') })
        .max(16, t('aetTitleLength', 'AET title must contain at most 16 characters'))
        .regex(
          /^[\x20-\x5b\x5d-\x7e]+$/,
          t('aetTitleCharacters', 'Use printable ASCII characters without a backslash'),
        ),
      scheduledReferringPhysician: z
        .string()
        .trim()
        .max(64, t('dicomFieldLength', 'Use at most {{count}} characters', { count: 64 }))
        .refine((value) => !!value, {
          message: t('scheduledReferringPhysicianWarn', 'Referring physician is required'),
        }),
      requestedProcedureDescription: z
        .string()
        .trim()
        .max(64, t('dicomFieldLength', 'Use at most {{count}} characters', { count: 64 }))
        .refine((value) => !!value, {
          message: t('requestedProcedureDescriptionWarn', 'Procedure description is required'),
        }),
      stepStartDate: z.date().refine((value) => !!value, t('stepDateWarn', 'Step date is required')),
      stepStartTime: z
        .string()
        .regex(/^(0?[1-9]|1[0-2]):[0-5][0-9]$/, t('validStepTime', 'Enter a valid time from 01:00 to 12:59')),
      timeFormat: z.enum(['AM', 'PM']),
      stationName: z
        .string()
        .trim()
        .max(16, t('dicomFieldLength', 'Use at most {{count}} characters', { count: 16 }))
        .nullable()
        .optional(),
      procedureStepLocation: z
        .string()
        .trim()
        .max(16, t('dicomFieldLength', 'Use at most {{count}} characters', { count: 16 }))
        .nullable()
        .optional(),
    });
  }, [t]);

  type NewProcedureStepFormData = z.infer<typeof procedureStepFormSchema>;

  const formProps = useForm<NewProcedureStepFormData>({
    mode: 'all',
    resolver: zodResolver(procedureStepFormSchema),
    defaultValues: {
      aetTitle: '',
      modality: modalityOptions[0].code,
      procedureStepLocation: '',
      requestedProcedureDescription: '',
      scheduledReferringPhysician: '',
      stationName: '',
      stepStartDate: undefined,
      stepStartTime: '',
      timeFormat: 'AM',
    },
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = formProps;

  // biome-ignore lint/correctness/useExhaustiveDependencies: Form edits must not carry over to a different patient or procedure request.
  useEffect(() => {
    reset();
  }, [patientUuid, request.id, reset]);

  useEffect(() => {
    promptBeforeClosing(() => isDirty);
  }, [isDirty, promptBeforeClosing]);

  const onSubmit = useCallback(
    async (data: NewProcedureStepFormData) => {
      if (request.patientUuid !== patientUuid) {
        showSnackbar({
          kind: 'error',
          title: t('imagingContextChanged', 'Reopen imaging for the current patient before saving.'),
        });
        return;
      }
      const fullTime = toDicomTimeString(data.stepStartTime, data.timeFormat);

      // copy the content because zod library makes everything optional
      const requestId: number = request.id;

      const payload: CreateRequestProcedureStep = {
        requestId: requestId,
        modality: data.modality,
        aetTitle: data.aetTitle,
        scheduledReferringPhysician: data.scheduledReferringPhysician,
        requestedProcedureDescription: data.requestedProcedureDescription,
        stepStartDate: toDicomDate(data.stepStartDate),
        stepStartTime: fullTime,
        stationName: data.stationName ? data.stationName : null,
        procedureStepLocation: data.procedureStepLocation ? data.procedureStepLocation : null,
      };

      const abortController = start();
      if (!abortController) return;
      try {
        await saveRequestProcedureStep(payload, requestId, abortController);
        if (!isCurrent(abortController)) return;
        void Promise.resolve()
          .then(() => mutate())
          .catch(() => {
            /* The read hook displays revalidation errors. */
          });
        closeWorkspaceWithSavedChanges();
        showSnackbar({
          kind: 'success',
          title: t('procedureStepSaved', 'Procedure step is saved successfully'),
        });
        void Promise.resolve()
          .then(() => requestMutate())
          .catch(() => {
            /* The read hook displays revalidation errors. */
          });
      } catch {
        if (!isCurrent(abortController)) return;
        showSnackbar({
          title: t('errorSavingProcedureStep', 'An error occurred while saving the procedure step'),
          kind: 'error',
          subtitle: t(
            'imagingOperationFailed',
            'The operation could not be completed. Refresh and check the result before trying again.',
          ),
          isLowContrast: false,
        });
      } finally {
        finish(abortController);
      }
    },
    [request, patientUuid, closeWorkspaceWithSavedChanges, t, mutate, requestMutate, start, isCurrent, finish],
  );

  return (
    <FormProvider {...formProps}>
      <Form className={styles.form} onSubmit={handleSubmit(onSubmit)} id="newRequestStepForm">
        <Stack gap={1} className={styles.container}>
          <section>
            <ResponsiveWrapper>
              <FormGroup legendText={t('modality', 'Modality')}>
                <Controller
                  name="modality"
                  control={control}
                  render={({ field: { value, onChange } }) => (
                    <div className={styles.row}>
                      <ComboBox
                        id="modality"
                        data-testid="modality"
                        itemToString={(item) => item?.label || ''}
                        items={modalityOptions}
                        onChange={({ selectedItem }) => onChange(selectedItem?.code)}
                        placeholder={t('selectModality', 'Select the modality')}
                        aria-label={t('modality', 'Modality')}
                        selectedItem={modalityOptions.find((opt) => opt.code === value)}
                        invalid={!!errors?.modality}
                        invalidText={errors?.modality?.message || t('modalityRequiredWarn', 'Modality is required')}
                      />
                    </div>
                  )}
                />
              </FormGroup>
            </ResponsiveWrapper>
          </section>
          <section>
            <ResponsiveWrapper>
              <Controller
                name="aetTitle"
                control={control}
                render={({ field: { onChange, value } }) => (
                  <div className={styles.row}>
                    <TextInput
                      type="text"
                      id="aetTitle"
                      labelText={t('aetTitle', 'AetTitle')}
                      value={value}
                      onChange={(evt) => onChange(evt.target.value)}
                      invalid={!!errors?.aetTitle}
                      invalidText={errors?.aetTitle?.message || t('aetTitleWarn', 'Aet Title is required')}
                    />
                  </div>
                )}
              />
            </ResponsiveWrapper>
          </section>
          <section>
            <ResponsiveWrapper>
              <Controller
                name="scheduledReferringPhysician"
                control={control}
                render={({ field: { onChange, value } }) => (
                  <div className={styles.row}>
                    <TextInput
                      type="text"
                      id="scheduledReferringPhysician"
                      labelText={t('scheduledReferringPhysician', 'scheduledReferringPhysician')}
                      value={value}
                      onChange={(evt) => onChange(evt.target.value)}
                      invalid={!!errors?.scheduledReferringPhysician}
                      invalidText={
                        errors?.scheduledReferringPhysician?.message ||
                        t('enterScheduledReferringPhysician', 'Scheduled referring physician is required')
                      }
                    />
                  </div>
                )}
              />
            </ResponsiveWrapper>
          </section>
          <section>
            <ResponsiveWrapper>
              <Controller
                name="requestedProcedureDescription"
                control={control}
                render={({ field: { onChange, value } }) => (
                  <div className={styles.row}>
                    <TextArea
                      id="requestedProcedureDescription"
                      labelText={t('description', 'Description')}
                      value={value}
                      onChange={(evt) => onChange(evt.target.value)}
                      invalid={!!errors?.requestedProcedureDescription}
                      invalidText={
                        errors?.requestedProcedureDescription?.message ||
                        t('enterDescription', 'Description is required')
                      }
                    />
                  </div>
                )}
              />
            </ResponsiveWrapper>
          </section>
          <section>
            <ResponsiveWrapper>
              <Controller
                name="stepStartDate"
                control={control}
                render={({ field, fieldState }) => (
                  <OpenmrsDatePicker
                    {...field}
                    id="stepStartDate"
                    data-testid="stepStartDate"
                    style={{ paddingBottom: '1rem', width: '100%' }}
                    labelText={t('stepStartDate', 'StepStartDate')}
                    invalid={Boolean(fieldState?.error?.message)}
                    invalidText={fieldState?.error?.message || t('selectStepStartDate', 'Start date is required')}
                  />
                )}
              />
            </ResponsiveWrapper>
          </section>
          <section>
            <ResponsiveWrapper>
              <Controller
                name="stepStartTime"
                control={control}
                render={({ field: { onBlur, onChange, value } }) => (
                  <TimePicker
                    id="stepStartTime"
                    data-testid="stepStartTime"
                    labelText={t('startTime', 'Start time')}
                    onChange={(event) => onChange(event.target.value)}
                    pattern="^(1[0-2]|0?[1-9]):[0-5][0-9]$"
                    style={{ marginLeft: '0.125rem', flex: 'none' }}
                    value={value}
                    onBlur={onBlur}
                    invalid={!!errors?.stepStartTime}
                    invalidText={errors?.stepStartTime?.message || t('selectStepStartTime', 'Start time is required')}
                  >
                    <Controller
                      name="timeFormat"
                      control={control}
                      render={({ field: { onChange, value } }) => (
                        <TimePickerSelect
                          id="timeFormatSelect"
                          onChange={(event) => onChange(event.target.value as amPm)}
                          value={value}
                          aria-label={t('timeFormat ', 'Time Format')}
                        >
                          <SelectItem value="AM" text={t('AM', 'AM')} />
                          <SelectItem value="PM" text={t('PM', 'PM')} />
                        </TimePickerSelect>
                      )}
                    />
                  </TimePicker>
                )}
              />
            </ResponsiveWrapper>
          </section>
          <section>
            <ResponsiveWrapper>
              <Controller
                name="stationName"
                control={control}
                render={({ field: { onChange, value } }) => (
                  <div className={styles.row}>
                    <TextInput
                      type="text"
                      id="stationName"
                      invalid={!!errors?.stationName}
                      invalidText={errors?.stationName?.message}
                      labelText={t('stationName', 'stationName')}
                      value={value}
                      onChange={(evt) => onChange(evt.target.value)}
                    />
                  </div>
                )}
              />
            </ResponsiveWrapper>
          </section>
          <section>
            <ResponsiveWrapper>
              <Controller
                name="procedureStepLocation"
                control={control}
                render={({ field: { onChange, value } }) => (
                  <div className={styles.row}>
                    <TextInput
                      type="text"
                      id="procedureStepLocation"
                      invalid={!!errors?.procedureStepLocation}
                      invalidText={errors?.procedureStepLocation?.message}
                      labelText={t('procedureStepLocation', 'procedureStepLocation')}
                      value={value}
                      onChange={(evt) => onChange(evt.target.value)}
                    />
                  </div>
                )}
              />
            </ResponsiveWrapper>
          </section>
        </Stack>
        <ButtonSet className={isTablet ? styles.tabletButtons : styles.desktopButtons}>
          <Button className={styles.button} kind="secondary" disabled={isPending} onClick={() => closeWorkspace()}>
            {t('discard', 'Discard')}
          </Button>
          <Button
            className={styles.button}
            kind="primary"
            disabled={isSubmitting || isPending || !canWrite}
            type="submit"
          >
            {isSubmitting ? (
              <InlineLoading description={t('saving', 'Saving') + '...'} />
            ) : (
              t('saveAndClose', 'Save and Close')
            )}
          </Button>
        </ButtonSet>
      </Form>
    </FormProvider>
  );
};

export default AddNewProcedureStepWorkspace;
