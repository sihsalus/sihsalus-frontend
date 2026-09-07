import {
  Button,
  ButtonSet,
  FileUploaderItem,
  InlineNotification,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@carbon/react';
import { showSnackbar } from '@openmrs/esm-framework';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { moduleName } from '../constants';
import CameraMediaUploaderContext from './camera-media-uploader-context.resources';
import styles from './upload-status.scss';

interface UploadStatusComponentProps {
  title?: string;
}

const UploadStatusComponent: React.FC<UploadStatusComponentProps> = ({ title }) => {
  const { t } = useTranslation(moduleName);
  const { filesToUpload, saveFile, closeModal, clearData, onCompletion } = useContext(CameraMediaUploaderContext);
  const [batch] = useState(() => (filesToUpload ?? []).map((file, id) => ({ file, id })));
  const [statuses, setStatuses] = useState<Array<'uploading' | 'complete' | 'failed'>>(() =>
    batch.map(() => 'uploading'),
  );
  const uploadStarted = useRef(false);
  const isUploading = statuses.includes('uploading');
  const uploadFailureMessage = t(
    'attachmentUploadFailed',
    'Upload could not be confirmed. Close this window and reload the attachments to check which files were saved before trying again.',
  );

  useEffect(() => {
    // This component represents one confirmed batch. Effect replay or new callback identities must not repeat POSTs.
    if (uploadStarted.current || batch.length === 0) {
      return;
    }
    uploadStarted.current = true;
    Promise.all(
      batch.map(async ({ file, id }) => {
        try {
          await saveFile(file);
        } catch {
          setStatuses((previous) => previous.map((status, fileIndex) => (fileIndex === id ? 'failed' : status)));
          showSnackbar({
            kind: 'error',
            subtitle: uploadFailureMessage,
            title: t('uploadError', 'Error uploading file'),
          });
          return false;
        }
        setStatuses((previous) => previous.map((status, fileIndex) => (fileIndex === id ? 'complete' : status)));
        showSnackbar({
          title: t('uploadComplete', 'Upload complete'),
          kind: 'success',
          isLowContrast: true,
        });
        return true;
      }),
    ).then((results) => {
      if (results.every(Boolean)) {
        onCompletion?.();
      }
    });
  }, [batch, onCompletion, saveFile, t, uploadFailureMessage]);

  return (
    <div className={styles.cameraSection}>
      <ModalHeader
        closeModal={closeModal}
        className={styles.modalHeader}
        title={title || t('addAttachment_title', 'Add Attachment')}
      />
      <ModalBody>
        <p className="cds--label-description">
          {t(
            'uploadWillContinueInTheBackground',
            'Files will be uploaded in the background. You can close this modal.',
          )}
        </p>

        <div className={styles.uploadingFilesSection}>
          {batch.map(({ file, id }) =>
            statuses[id] === 'failed' ? (
              <InlineNotification
                key={id}
                hideCloseButton
                kind="error"
                role="alert"
                title={file.fileName}
                subtitle={uploadFailureMessage}
              />
            ) : (
              <FileUploaderItem
                key={id}
                name={file.fileName}
                status={statuses[id] === 'uploading' ? 'uploading' : 'complete'}
                iconDescription={
                  statuses[id] === 'uploading' ? t('uploading', 'Uploading') : t('uploadComplete', 'Upload complete')
                }
                size="lg"
              />
            ),
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <ButtonSet className={styles.buttonSet}>
          <Button size="lg" kind="secondary" onClick={clearData} disabled={isUploading || statuses.includes('failed')}>
            {t('addMoreAttachments', 'Add more attachments')}
          </Button>
          <Button size="lg" kind="primary" onClick={closeModal}>
            {t('closeModal', 'Close')}
          </Button>
        </ButtonSet>
      </ModalFooter>
    </div>
  );
};

export default UploadStatusComponent;
