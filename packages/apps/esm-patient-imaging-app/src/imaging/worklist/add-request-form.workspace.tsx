import {
  Button,
  ButtonSet,
  ComboBox,
  Form,
  FormGroup,
  InlineLoading,
  InlineNotification,
  Stack,
  TextArea,
  TextInput,
} from '@carbon/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { ResponsiveWrapper, showSnackbar, useLayoutType } from '@openmrs/esm-framework';
import { type DefaultPatientWorkspaceProps } from '@openmrs/esm-patient-common-lib';
import React, { useCallback, useEffect, useMemo } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { saveRequestProcedure, useOrthancConfigurations, useRequestsByPatient } from '../../api';
import { type CreateRequestProcedure, type OrthancConfiguration, priorityLevels } from '../../types';
import { generateAccessionNumber } from '../utils/help';
import { useImagingOperation } from '../utils/use-imaging-operation';
import styles from './worklist.scss';

const AddNewRequestWorkspace: React.FC<DefaultPatientWorkspaceProps> = ({
  patientUuid,
  closeWorkspace,
  closeWorkspaceWithSavedChanges,
  promptBeforeClosing,
}) => {
  const { t } = useTranslation();
  const { start, isCurrent, finish, isPending, canWrite } = useImagingOperation(patientUuid);
  const isTablet = useLayoutType() === 'tablet';
  const orthancConfigurations = useOrthancConfigurations();
  const { mutate } = useRequestsByPatient(patientUuid);

  const requestFormSchema = useMemo(() => {
    return z.object({
      id: z.number().nullable().optional(),
      orthancConfiguration: z.object({
        id: z.number().int().positive(),
        orthancBaseUrl: z.string(),
        orthancProxyUrl: z.string().nullable().optional(),
      }),
      accessionNumber: z
        .string()
        .trim()
        .nonempty({ message: t('accessNumberWarn', 'Accession number is required') })
        .max(16, t('accessionNumberLength', 'Accession number must contain at most 16 characters')),
      requestingPhysician: z
        .string()
        .trim()
        .max(64, t('dicomFieldLength', 'Use at most {{count}} characters', { count: 64 }))
        .refine((value) => !!value, {
          message: t('requestingPhysicianMsg', 'Enter the requesting physician name'),
        }),
      requestDescription: z
        .string()
        .trim()
        .max(64, t('dicomFieldLength', 'Use at most {{count}} characters', { count: 64 }))
        .refine((value) => !!value, {
          message: t('requestDescriptionMsg', 'Enter the request description'),
        }),
      priority: z
        .string()
        .refine((value) => priorityLevels.includes(value), { message: t('priorityWarn', 'Priority is required') }),
    });
  }, [t]);

  type NewRequestFormData = z.infer<typeof requestFormSchema>;

  const formProps = useForm<NewRequestFormData>({
    mode: 'all',
    resolver: zodResolver(requestFormSchema),
    defaultValues: {
      accessionNumber: '',
      orthancConfiguration: undefined,
      priority: 'low',
      requestDescription: '',
      requestingPhysician: '',
    },
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = formProps;

  // biome-ignore lint/correctness/useExhaustiveDependencies: Changing patients must discard the previous patient's procedure request draft.
  useEffect(() => {
    reset();
  }, [patientUuid, reset]);

  useEffect(() => {
    promptBeforeClosing(() => isDirty);
  }, [isDirty, promptBeforeClosing]);

  const onSubmit = useCallback(
    async (data: NewRequestFormData) => {
      const abortController = start();
      if (!abortController) return;

      const payload: CreateRequestProcedure = {
        orthancConfiguration: {
          id: data.orthancConfiguration.id,
          orthancBaseUrl: data.orthancConfiguration.orthancBaseUrl,
          orthancProxyUrl: data.orthancConfiguration.orthancProxyUrl,
        },
        patientUuid: patientUuid,
        accessionNumber: data.accessionNumber,
        requestingPhysician: data.requestingPhysician,
        requestDescription: data.requestDescription,
        priority: data.priority,
      };

      try {
        await saveRequestProcedure(payload, patientUuid, abortController);
        if (!isCurrent(abortController)) return;
        void Promise.resolve()
          .then(() => mutate())
          .catch(() => {
            /* The read hook displays revalidation errors. */
          });
        closeWorkspaceWithSavedChanges();
        showSnackbar({
          kind: 'success',
          title: t('requestSaved', 'Request saved successfully'),
        });
      } catch {
        if (!isCurrent(abortController)) return;
        showSnackbar({
          title: t('errorSavingRequest', 'An error occurred while saving the request procedure'),
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
    [patientUuid, closeWorkspaceWithSavedChanges, t, mutate, start, isCurrent, finish],
  );

  return (
    <FormProvider {...formProps}>
      <Form className={styles.form} id="newRequestForm" onSubmit={handleSubmit(onSubmit)}>
        <Stack gap={1} className={styles.container}>
          {orthancConfigurations.error && (
            <InlineNotification
              kind="error"
              lowContrast
              hideCloseButton
              title={t('imagingConfigurationUnavailable', 'Imaging servers could not be loaded.')}
            />
          )}
          <section>
            <ResponsiveWrapper>
              <FormGroup legendText={t('orthancConfiguration', 'Orthanc configurations')}>
                <Controller
                  name="orthancConfiguration"
                  control={control}
                  render={({ field: { value, onChange } }) => (
                    <ComboBox
                      id="orthancConfiguration"
                      itemToString={(item: OrthancConfiguration) => item?.orthancBaseUrl}
                      items={orthancConfigurations.data || []}
                      onChange={({ selectedItem }) => onChange(selectedItem)}
                      placeholder={t('selectOrthancServer', 'Select an Orthanc server')}
                      selectedItem={value}
                      invalid={!!errors.orthancConfiguration}
                      invalidText={
                        errors.orthancConfiguration?.message ||
                        t('selectValidServer', 'Please select a valid Orthanc server')
                      }
                    />
                  )}
                />
              </FormGroup>
            </ResponsiveWrapper>
          </section>
          <section>
            <ResponsiveWrapper>
              <Controller
                name="accessionNumber"
                control={control}
                render={({ field: { onChange, value } }) => (
                  <div className={'div'} style={{ display: 'flex' }}>
                    <TextInput
                      type="text"
                      id="accessionNumber"
                      data-testid="accessionNumber"
                      labelText={t('accessionNumber', 'Accession Number')}
                      value={value}
                      onChange={(evt) => onChange(evt.target.value)}
                      invalid={!!errors.accessionNumber}
                      invalidText={
                        errors.accessionNumber?.message ||
                        t('enterAccessionNumber', 'Please enter the accession number')
                      }
                    />
                    <Button type="button" onClick={() => onChange(generateAccessionNumber())} style={{ width: '15px' }}>
                      {t('generateNumber', 'Generate number')}
                    </Button>
                  </div>
                )}
              />
            </ResponsiveWrapper>
          </section>
          <section>
            <ResponsiveWrapper>
              <Controller
                name="requestingPhysician"
                control={control}
                render={({ field: { onChange, value } }) => (
                  <div className={styles.row}>
                    <TextInput
                      type="text"
                      id="requestingPhysician"
                      labelText={t('requestingPhysician', 'Physician')}
                      value={value}
                      onChange={(evt) => onChange(evt.target.value)}
                      invalid={!!errors.requestingPhysician}
                      invalidText={
                        errors.requestingPhysician?.message ||
                        t('enterRequestingPhysician', 'Please enter the physician name')
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
                name="requestDescription"
                control={control}
                render={({ field: { onChange, value } }) => (
                  <div className={styles.row}>
                    <TextArea
                      id="requestDescription"
                      labelText={t('requestDescription', 'Request procedure description')}
                      value={value}
                      onChange={(evt) => onChange(evt.target.value)}
                      invalid={!!errors?.requestDescription}
                      invalidText={
                        errors?.requestDescription?.message ||
                        t('enterRequestDescription', 'Please enter the request procedure description')
                      }
                    />
                  </div>
                )}
              />
            </ResponsiveWrapper>
          </section>
          <section>
            <ResponsiveWrapper>
              <FormGroup legendText={t('priority', 'priority')}>
                <Controller
                  name="priority"
                  control={control}
                  defaultValue="low"
                  render={({ field: { value, onChange } }) => (
                    <ComboBox
                      id="priority"
                      itemToString={(item: string) => item}
                      items={priorityLevels}
                      onChange={({ selectedItem }) => onChange(selectedItem)}
                      placeholder={t('selectPriority', 'Select the request priority')}
                      selectedItem={value}
                      invalid={!!errors.priority}
                      invalidText={errors.priority?.message || t('selectPriority', 'Select the request priority')}
                    />
                  )}
                />
              </FormGroup>
            </ResponsiveWrapper>
          </section>
        </Stack>
        <ButtonSet className={isTablet ? styles.tabletButtons : styles.desktopButtons}>
          <Button className={styles.button} onClick={() => closeWorkspace()} disabled={isPending} kind="secondary">
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

export default AddNewRequestWorkspace;
