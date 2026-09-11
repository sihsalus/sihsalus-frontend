import {
  Button,
  ComboBox,
  FileUploaderButton,
  FileUploaderItem,
  Form,
  FormGroup,
  InlineLoading,
  InlineNotification,
  Row,
  Stack,
} from '@carbon/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { ExtensionSlot, ResponsiveWrapper, showSnackbar, useLayoutType } from '@openmrs/esm-framework';
import { type DefaultPatientWorkspaceProps } from '@openmrs/esm-patient-common-lib';
import React, { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { StudyUploadError, uploadStudies, useOrthancConfigurations, useStudiesByPatient } from '../../api';
import { type OrthancConfiguration } from '../../types';
import { maxUploadImageDataSize } from '../constants';
import { useImagingOperation } from '../utils/use-imaging-operation';
import styles from './studies.scss';

const UploadStudiesWorkspace: React.FC<DefaultPatientWorkspaceProps> = ({ patientUuid, closeWorkspace }) => {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const mounted = useRef(true);
  const patientScope = useRef({ patientUuid });
  if (patientScope.current.patientUuid !== patientUuid) patientScope.current = { patientUuid };
  // Access can change mid-upload; reconcile this queue before allowing another batch.
  const pendingUpload = useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [uploadIssue, setUploadIssue] = useState<string | null>(null);
  const { start, isCurrent, finish, isPending, canWrite } = useImagingOperation(patientUuid);
  useEffect(() => {
    setSelectedFiles([]);
    setUploadIssue(null);
  }, [patientUuid]);
  const orthancConfigurations = useOrthancConfigurations();
  const { mutate } = useStudiesByPatient(patientUuid);
  const patientState = useMemo(() => ({ patientUuid }), [patientUuid]);

  const uploadStudiesFormSchema = useMemo(() => {
    return z.object({
      orthancConfiguration: z.object({
        id: z.number().int().positive(),
        orthancBaseUrl: z.string(),
        orthancProxyUrl: z.string().nullable().optional(),
      }),
    });
  }, []);

  type UploadStudiesFormData = z.infer<typeof uploadStudiesFormSchema>;

  const formProps = useForm<UploadStudiesFormData>({
    mode: 'all',
    resolver: zodResolver(uploadStudiesFormSchema),
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = formProps;

  useEffect(() => {
    reset();
  }, [patientUuid, reset]);

  const onSubmit = useCallback(
    async (data: UploadStudiesFormData) => {
      const { orthancConfiguration } = data;

      // copy the content because zod library makes everything optional
      const serverConfig: OrthancConfiguration = {
        id: orthancConfiguration.id,
        orthancBaseUrl: orthancConfiguration.orthancBaseUrl,
        orthancProxyUrl: orthancConfiguration.orthancProxyUrl,
      };

      if (selectedFiles.length === 0) {
        showSnackbar({
          title: t('uploadStudiesError', 'Upload studies error'),
          subtitle: t('selectFilesUploadError', 'Select files to upload'),
          kind: 'error',
          isLowContrast: false,
        });
        return;
      }

      const oversized = selectedFiles.some((file) => file.size > maxUploadImageDataSize);
      if (oversized) {
        showSnackbar({
          title: t('uploadStuiesError', 'Upload stuies error'),
          subtitle:
            t('uploadErrorMsg', 'One or more files exceed the size limit of ') +
            `${maxUploadImageDataSize / 1000000} MB.`,
          kind: 'error',
          isLowContrast: false,
        });
        return;
      }

      if (selectedFiles.some((file) => !/\.dcm$/i.test(file.name) || file.size === 0)) {
        setUploadIssue(
          t('dicomOnly', 'Select non-empty .dcm files. ZIP upload is unavailable with this imaging server.'),
        );
        return;
      }
      if (pendingUpload.current) return;
      const abortController = start();
      if (!abortController) return;
      pendingUpload.current = abortController;
      const submittedScope = patientScope.current;
      const canReconcileQueue = () =>
        mounted.current && patientScope.current === submittedScope && pendingUpload.current === abortController;
      setUploadIssue(null);
      try {
        await uploadStudies(selectedFiles, serverConfig, patientUuid, abortController);
        if (!canReconcileQueue()) return;
        setSelectedFiles([]);
        if (!isCurrent(abortController)) {
          setUploadIssue(
            t(
              'uploadSavedRefreshFailed',
              'The files were uploaded, but the study list could not be refreshed. Reopen the imaging tab to check them.',
            ),
          );
          return;
        }
        try {
          await mutate();
        } catch {
          if (isCurrent(abortController)) {
            setUploadIssue(
              t(
                'uploadSavedRefreshFailed',
                'The files were uploaded, but the study list could not be refreshed. Reopen the imaging tab to check them.',
              ),
            );
          }
          return;
        }
        if (isCurrent(abortController)) closeWorkspace();
      } catch (error) {
        if (!canReconcileQueue()) return;
        if (!(error instanceof StudyUploadError)) {
          // API preflight errors occur before any file is sent; preserve that queue.
          setUploadIssue(
            t(
              'imagingOperationFailed',
              'The operation could not be completed. Refresh and check the result before trying again.',
            ),
          );
          if (isCurrent(abortController))
            showSnackbar({
              title: t('uploadStudiesError', 'Upload studies error'),
              kind: 'error',
              isLowContrast: false,
              subtitle: t(
                'imagingOperationFailed',
                'The operation could not be completed. Refresh and check the result before trying again.',
              ),
            });
          return;
        }
        const completed = error.completedFiles.length;
        const failedIndex = error.failedIndex;
        // Keep only files that have not been sent. The uncertain file requires review.
        setSelectedFiles(selectedFiles.slice(failedIndex + (error.hasUncertainFile ? 1 : 0)));
        setUploadIssue(
          error.hasUncertainFile
            ? t(
                'uploadInterrupted',
                '{{count}} files confirmed. Check {{file}} in the study list before selecting it again. Unsent files remain in the queue.',
                { count: completed, file: selectedFiles[failedIndex]?.name ?? '' },
              )
            : t(
                'uploadStopped',
                '{{count}} files confirmed. Upload stopped before sending the next file. Unsent files remain in the queue.',
                { count: completed },
              ),
        );
        // Reconcile even after an abort, but do not perform authorized UI actions in a stale session.
        if (!isCurrent(abortController)) return;
        void Promise.resolve()
          .then(() => mutate())
          .catch(() => {
            /* The study list exposes its refresh error. */
          });
        showSnackbar({
          title: t('uploadStudiesError', 'Upload studies error'),
          kind: 'error',
          isLowContrast: false,
          subtitle: t(
            'imagingOperationFailed',
            'The operation could not be completed. Refresh and check the result before trying again.',
          ),
        });
      } finally {
        if (pendingUpload.current === abortController) pendingUpload.current = null;
        finish(abortController);
      }
    },
    [selectedFiles, t, closeWorkspace, patientUuid, mutate, start, isCurrent, finish],
  );

  return (
    <FormProvider {...formProps}>
      <Form className={styles.form} encType="multipart/form-data" onSubmit={handleSubmit(onSubmit)} id="uploadStudies">
        {isTablet ? (
          <Row className={styles.header}>
            <ExtensionSlot className={styles.content} name="patient-details-header-slot" state={patientState} />
          </Row>
        ) : null}
        <Stack gap={1} className={styles.formContent}>
          {orthancConfigurations.error && (
            <InlineNotification
              kind="error"
              lowContrast
              hideCloseButton
              title={t('imagingConfigurationUnavailable', 'Imaging servers could not be loaded.')}
            />
          )}
          {uploadIssue && <InlineNotification kind="warning" lowContrast hideCloseButton title={uploadIssue} />}
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
                      disabled={isSubmitting || isPending || !canWrite}
                      invalid={!!errors.orthancConfiguration}
                      data-testid="orthanc-server-combobox"
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
            <div className={styles.container}>
              <div data-testid="upload-studies-fileuploader">
                <p>
                  {t('selectDicomFiles', 'Select DICOM files (.dcm). Maximum size per file:')}{' '}
                  {maxUploadImageDataSize / 1000000} MB
                </p>
                <FileUploaderButton
                  name="files"
                  labelText={t('chooseFiles', 'Choose Files')}
                  multiple
                  accept={['.dcm']}
                  disabled={isSubmitting || isPending || !canWrite}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    const files = Array.from(event.target.files ?? []);
                    setSelectedFiles((previous) => [...previous, ...files]);
                    event.target.value = '';
                  }}
                />
                {selectedFiles.map((file, index) => (
                  <FileUploaderItem
                    key={`${file.name}-${index}`}
                    name={file.name}
                    status={isSubmitting || isPending ? 'uploading' : 'edit'}
                    iconDescription={t('removeFile', 'Remove file')}
                    onDelete={() =>
                      setSelectedFiles((files) => files.filter((_, selectedIndex) => selectedIndex !== index))
                    }
                  />
                ))}
              </div>
            </div>
          </section>
          {isSubmitting ? (
            <div className={styles.uploadProgress} data-testid="upload-studies-loading">
              <InlineLoading description={t('uploadingStudies', 'Uploading studies...')} />
            </div>
          ) : null}
          <div className={styles['popup-box-btn']}>
            <Button
              type="submit"
              kind="primary"
              data-testid="upload-studies-submit"
              disabled={isSubmitting || isPending || !canWrite}
            >
              {isSubmitting ? (
                <InlineLoading description={t('uploading', 'Uploading') + '...'} />
              ) : (
                t('upload', 'Upload')
              )}
            </Button>
            <Button
              kind="secondary"
              onClick={() => closeWorkspace()}
              data-testid="upload-studies-cancel"
              disabled={isSubmitting || isPending}
            >
              {t('cancel', 'Cancel')}
            </Button>
          </div>
        </Stack>
      </Form>
    </FormProvider>
  );
};

export default UploadStudiesWorkspace;
