import { Button, ComboBox, FileUploader, Form, FormGroup, Row, Stack } from '@carbon/react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createErrorHandler,
  ExtensionSlot,
  ResponsiveWrapper,
  showSnackbar,
  useLayoutType,
} from '@openmrs/esm-framework';
import { type DefaultPatientWorkspaceProps } from '@openmrs/esm-patient-common-lib';
import React, { useCallback, useMemo, useState } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { uploadStudies, useOrthancConfigurations } from '../../api';
import { type OrthancConfiguration } from '../../types';
import { maxUploadImageDataSize } from '../constants';
import styles from './studies.scss';

const UploadStudiesWorkspace: React.FC<DefaultPatientWorkspaceProps> = ({ patientUuid, closeWorkspace }) => {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const orthancConfigurations = useOrthancConfigurations();
  const patientState = useMemo(() => ({ patientUuid }), [patientUuid]);

  const uploadStudiesFormSchema = useMemo(() => {
    return z.object({
      orthancConfiguration: z.object({
        id: z.number(),
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
    formState: { errors, isDirty },
  } = formProps;

  const onSubmit = useCallback(
    (data: UploadStudiesFormData) => {
      const { orthancConfiguration } = data;
      const abortController = new AbortController();

      // copy the content because zod library makes everything optional
      const serverConfig: OrthancConfiguration = {
        id: orthancConfiguration.id,
        orthancBaseUrl: orthancConfiguration.orthancBaseUrl,
        orthancProxyUrl: orthancConfiguration.orthancProxyUrl,
      };

      if (selectedFiles.length === 0) {
        showSnackbar({
          title: 'Upload studies error',
          subtitle: 'Select files to upload',
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

      uploadStudies(selectedFiles, serverConfig, abortController)
        .then(() => {
          closeWorkspace();
          return () => abortController.abort();
        })
        .catch((err) => {
          createErrorHandler();
          showSnackbar({
            title: t('uploadStudiesError', 'Upload studies error'),
            kind: 'error',
            isLowContrast: false,
            subtitle: t('checkForUpload', 'Check for upload') + ': ' + err?.message,
          });
        });
    },
    [selectedFiles, t, closeWorkspace],
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
              <FileUploader
                data-testid="upload-studies-fileuploader"
                labelTitle={
                  t('selectFilesToUpload', 'Select files to upload (dicom or zip). Max size:') +
                  `${maxUploadImageDataSize / 1000000} MB`
                }
                name="files"
                buttonLabel={t('chooseFiles', 'Choose Files')}
                multiple
                accept={['.dcm', '.zip']}
                filenameStatus="complete"
                onChange={(e: any) => {
                  const files = Array.from<File>(e.target.files ?? []);
                  setSelectedFiles(files);
                }}
              />
            </div>
          </section>
          <div className={styles['popup-box-btn']}>
            <Button type="submit" kind="primary" data-testid="upload-studies-submit">
              {t('upload', 'Upload')}
            </Button>
            <Button kind="secondary" onClick={() => closeWorkspace()} data-testid="upload-studies-cancel">
              {t('cancel', 'Cancel')}
            </Button>
          </div>
        </Stack>
      </Form>
    </FormProvider>
  );
};

export default UploadStudiesWorkspace;
