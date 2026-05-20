import {
  Button,
  ButtonSkeleton,
  Column,
  FileUploaderDropContainer,
  FileUploaderItem,
  FileUploaderSkeleton,
  Form,
  Grid,
  InlineLoading,
  SkeletonText,
  Stack,
} from '@carbon/react';
import { ErrorState, showSnackbar } from '@openmrs/esm-framework';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { extractOclErrorMessage, isAbortError } from '../utils';

import { startImportWithFile, startImportWithSubscription, useSubscription } from './import.resource';
import styles from './import.scss';

const allowedMimeTypes = ['application/zip', 'application/x-zip-compressed'];

const Import: React.FC = () => {
  const { t } = useTranslation();
  const [isSubscriptionAvailable, setIsSubscriptionAvailable] = useState(false);
  const [file, setFile] = useState<File>();
  const [isFileUploading, setIsFileUploading] = useState(false);

  const { data: subscription, isLoading, error } = useSubscription();

  useEffect(() => {
    if (!isLoading && !error) {
      setIsSubscriptionAvailable(!!subscription);
    }
  }, [isLoading, error, subscription]);

  const onAddFiles = useCallback(
    (_evt: React.DragEvent<HTMLInputElement>, { addedFiles }: { addedFiles: File[] }) => {
      const fileToUpload: File = addedFiles[0];
      if (!allowedMimeTypes.includes(fileToUpload.type)) {
        showSnackbar({
          title: t('invalidFile', 'Invalid file'),
          kind: 'error',
          subtitle: t('fileFormatError', 'Only .zip files are allowed'),
        });
      } else {
        setFile(fileToUpload);
      }
    },
    [t],
  );

  const handleFileUploaderItemClick = useCallback(() => {
    setFile(null);
  }, []);

  const handleImportWithSubscription = useCallback(
    async (evt: React.FormEvent<HTMLFormElement>) => {
      evt.preventDefault();
      evt.stopPropagation();

      if (!isSubscriptionAvailable) {
        showSnackbar({
          title: t('noSubscription', 'No subscription'),
          kind: 'error',
          subtitle: t('noSubscriptionError', 'No saved subscription'),
        });
        return;
      }

      const abortController = new AbortController();
      try {
        const response = await startImportWithSubscription(abortController);

        if (response.status === 201) {
          showSnackbar({
            title: t('importStarted', 'Import started'),
            kind: 'success',
            subtitle: t('importSuccess', 'Import started successfully'),
          });
        } else {
          showSnackbar({
            title: t('importFailed', 'Import failed'),
            kind: 'error',
            subtitle: extractOclErrorMessage(response, t),
          });
        }
      } catch (err) {
        if (!isAbortError(err)) {
          showSnackbar({
            title: t('importFailed', 'Import failed'),
            kind: 'error',
            subtitle: t('networkError', 'A network error occurred — check your connection'),
          });
        }
      } finally {
        abortController.abort();
      }
    },
    [isSubscriptionAvailable, t],
  );

  const handleImportWithFile = useCallback(
    async (evt: React.FormEvent<HTMLFormElement>) => {
      setIsFileUploading(true);
      evt.preventDefault();
      evt.stopPropagation();

      if (!file) {
        setIsFileUploading(false);
        showSnackbar({
          title: t('noFile', 'No file'),
          kind: 'error',
          subtitle: t('noFileSelected', 'No file selected'),
        });
        return;
      }

      const abortController = new AbortController();
      try {
        const response = await startImportWithFile(file, abortController);

        if (response.status === 201) {
          setFile(null);
          showSnackbar({
            title: t('importStarted', 'Import started'),
            kind: 'success',
            subtitle: t('importSuccess', 'Import started successfully'),
          });
        } else {
          showSnackbar({
            title: t('importFailed', 'Import failed'),
            kind: 'error',
            subtitle: extractOclErrorMessage(response, t),
          });
        }
      } catch (err) {
        if (!isAbortError(err)) {
          showSnackbar({
            title: t('importFailed', 'Import failed'),
            kind: 'error',
            subtitle: t('networkError', 'A network error occurred — check your connection'),
          });
        }
      } finally {
        setIsFileUploading(false);
        abortController.abort();
      }
    },
    [file, t],
  );

  if (isLoading) {
    return (
      <Grid className={styles.grid}>
        <Column sm={4} md={8} lg={10}>
          <Form>
            <SkeletonText className={styles.productiveHeading03} heading />
            <SkeletonText className={styles.formText} paragraph lineCount={2} />
            <ButtonSkeleton />
          </Form>

          <Form className={styles.form}>
            <SkeletonText className={styles.productiveHeading03} heading />
            <SkeletonText className={styles.formText} />
            <FileUploaderSkeleton style={{ marginBottom: '1.5rem' }} />
            <ButtonSkeleton />
          </Form>
        </Column>
      </Grid>
    );
  }

  if (error) {
    return <ErrorState headerTitle={t('import', 'Import')} error={error} />;
  }

  return (
    <Grid className={styles.grid}>
      <Column sm={4} md={8} lg={10}>
        <Form onSubmit={(evt) => void handleImportWithSubscription(evt)}>
          <h3 className={styles.productiveHeading03}>{t('importConcepts', 'Import Concepts')}</h3>
          <p className={styles.formText}>
            {t(
              'importInstructions',
              'Avoid importing during data entry hours, because the operation may significantly slow down the system. You can either use the subscription or a zip file to import concepts.',
            )}
          </p>
          <Button kind="primary" type="submit" disabled={!isSubscriptionAvailable}>
            {t('importFromSubscription', 'Import from Subscription')}
          </Button>
        </Form>

        <Form className={styles.form} onSubmit={(evt) => void handleImportWithFile(evt)}>
          <h3 className={styles.productiveHeading03}>{t('importFromFileHeading', 'Import from file (Offline)')}</h3>
          <p className={styles.formText}>
            {t('importFromFileInfo', 'You can import data without setting up a subscription by using this option.')}
          </p>
          {file ? (
            <FileUploaderItem
              key={file.name}
              name={file.name}
              size="md"
              status="edit"
              iconDescription={t('fileAdded', 'File Added')}
              onDelete={handleFileUploaderItemClick}
              style={{ backgroundColor: '#e0e0e0' }}
            />
          ) : (
            <FileUploaderDropContainer
              accept={['application/zip', 'application/x-zip-compressed']}
              multiple
              labelText={t('importFromFileDragInfo', 'Drag and drop file here or click to upload')}
              onAddFiles={onAddFiles}
              style={{ marginBottom: '1.5rem' }}
            />
          )}
          <Stack gap={6} orientation="horizontal">
            <Button kind="primary" type="submit">
              {t('importFromFile', 'Import from file')}
            </Button>
            {isFileUploading && <InlineLoading description={t('uploading', 'Uploading...')} />}
          </Stack>
        </Form>
      </Column>
    </Grid>
  );
};

export default Import;
