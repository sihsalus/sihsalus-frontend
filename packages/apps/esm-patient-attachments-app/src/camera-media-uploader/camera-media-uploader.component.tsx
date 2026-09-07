import { InlineNotification, ModalBody, ModalHeader, Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import { type FetchResponse, type UploadedFile } from '@openmrs/esm-framework';
import { parseAllowedFileExtensions, useAllowedFileExtensions } from '@openmrs/esm-patient-common-lib';
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { moduleName } from '../constants';
import CameraComponent from './camera.component';
import styles from './camera-media-uploader.scss';
import CameraMediaUploaderContext from './camera-media-uploader-context.resources';
import { type CameraMediaUploadView } from './camera-media-uploader-types';
import FileReviewContainer from './file-review.component';
import MediaUploaderComponent from './media-uploader.component';
import UploadStatusComponent from './upload-status.component';

interface CameraMediaUploaderModalProps {
  allowedExtensions?: Array<string>;
  cameraOnly?: boolean;
  closeModal: () => void;
  collectDescription?: boolean;
  multipleFiles?: boolean;
  onCompletion?: () => void;
  saveFile: (file: UploadedFile) => Promise<FetchResponse<unknown>>;
  /** Requires an explicit workflow allowlist backed by scoped server validation. */
  skipConfiguredAllowlistLookup?: boolean;
  title?: string;
  initialView?: CameraMediaUploadView;
  maxFileSizeMb?: number;
}

interface CameraMediaUploadTabsProps {
  title?: string;
}

const CameraMediaUploaderModal: React.FC<CameraMediaUploaderModalProps> = ({
  allowedExtensions,
  cameraOnly,
  closeModal,
  collectDescription,
  multipleFiles,
  onCompletion,
  saveFile,
  skipConfiguredAllowlistLookup,
  title,
  initialView,
  maxFileSizeMb,
}) => {
  const { t } = useTranslation(moduleName);
  const hasExplicitAllowlist = allowedExtensions !== undefined;
  const usesWorkflowAllowlistOnly = Boolean(skipConfiguredAllowlistLookup && hasExplicitAllowlist);
  const {
    allowedFileExtensions,
    error: configurationError,
    isConfigured,
    isLoading,
  } = useAllowedFileExtensions(!usesWorkflowAllowlistOnly);
  const [error, setError] = useState<Error | null>(null);
  const [filesToUpload, setFilesToUpload] = useState<Array<UploadedFile>>([]);
  const [uploadFilesToServer, setUploadFilesToServer] = useState(false);
  const effectiveAllowedExtensions = useMemo(() => {
    if (!hasExplicitAllowlist) {
      return allowedFileExtensions;
    }

    const workflowAllowlist = parseAllowedFileExtensions(allowedExtensions?.join(',') ?? '');
    return usesWorkflowAllowlistOnly
      ? workflowAllowlist
      : allowedFileExtensions.filter((extension) => workflowAllowlist.includes(extension));
  }, [allowedExtensions, allowedFileExtensions, hasExplicitAllowlist, usesWorkflowAllowlistOnly]);
  const canCapturePhoto = effectiveAllowedExtensions.includes('png');
  const uploadConfigurationUnavailable =
    !isLoading &&
    ((!usesWorkflowAllowlistOnly && !isConfigured) ||
      effectiveAllowedExtensions.length === 0 ||
      (cameraOnly && !canCapturePhoto));

  const handleTakePhoto = useCallback(
    (file: string) => {
      if (!canCapturePhoto) {
        setError(new Error('PNG attachments are not permitted by the configured allowlist.'));
        return;
      }
      setFilesToUpload([
        {
          base64Content: file,
          fileName: 'Image taken from camera',
          fileType: 'image',
          fileDescription: '',
          status: 'uploading',
          capturedFromWebcam: true,
        },
      ]);
    },
    [canCapturePhoto],
  );

  const clearData = useCallback(() => {
    setFilesToUpload([]);
    setUploadFilesToServer(false);
    setError(null);
  }, []);

  const startUploadingToServer = useCallback(() => {
    setUploadFilesToServer(true);
  }, []);

  const returnComponent = useMemo(() => {
    // If the files are all set to upload, then filesUploader is visible on the screen.
    if (uploadFilesToServer) {
      return <UploadStatusComponent title={title} />;
    }

    if (filesToUpload.length) {
      return <FileReviewContainer title={title} onCompletion={startUploadingToServer} />;
    }

    return <CameraMediaUploadTabs title={title} />;
  }, [uploadFilesToServer, filesToUpload, startUploadingToServer, title]);

  if (isLoading) {
    return (
      <div className={styles.cameraSection}>
        <ModalHeader closeModal={closeModal} title={title || t('addAttachment_title', 'Add attachment')} />
        <ModalBody>
          <InlineNotification
            hideCloseButton
            kind="info"
            subtitle={t('attachmentConfigurationLoading', 'Loading the permitted attachment types.')}
            title={t('attachmentConfigurationLoadingTitle', 'Checking attachment configuration')}
          />
        </ModalBody>
      </div>
    );
  }

  if ((!usesWorkflowAllowlistOnly && configurationError) || uploadConfigurationUnavailable) {
    return (
      <div className={styles.cameraSection}>
        <ModalHeader closeModal={closeModal} title={title || t('addAttachment_title', 'Add attachment')} />
        <ModalBody>
          <InlineNotification
            hideCloseButton
            kind="error"
            subtitle={t(
              'attachmentUploadUnavailable',
              'No permitted attachment types have been configured. Contact the system administrator.',
            )}
            title={t('attachmentUploadUnavailableTitle', 'Attachment upload unavailable')}
          />
        </ModalBody>
      </div>
    );
  }

  return (
    <CameraMediaUploaderContext.Provider
      value={{
        allowedExtensions: effectiveAllowedExtensions,
        cameraOnly,
        clearData,
        closeModal,
        collectDescription,
        error,
        filesToUpload,
        handleTakePhoto,
        initialView,
        maxFileSizeMb,
        multipleFiles,
        onCompletion,
        saveFile,
        setError,
        setFilesToUpload,
        setUploadFilesToServer,
        uploadFilesToServer,
      }}
    >
      {returnComponent}
    </CameraMediaUploaderContext.Provider>
  );
};

const CameraMediaUploadTabs: React.FC<CameraMediaUploadTabsProps> = ({ title }) => {
  const { t } = useTranslation(moduleName);
  const { allowedExtensions = [], cameraOnly, closeModal, error, initialView } = useContext(CameraMediaUploaderContext);
  const mediaStream = useRef<MediaStream | undefined>();
  const canCapturePhoto = allowedExtensions.includes('png');
  const [view, setView] = useState<CameraMediaUploadView>(
    initialView === 'camera' && canCapturePhoto ? 'camera' : 'upload',
  );

  const stopCameraStream = useCallback(() => {
    mediaStream.current?.getTracks().forEach((t) => {
      t.stop();
    });
    mediaStream.current = undefined;
  }, []);

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, [stopCameraStream]);

  if (cameraOnly) {
    return <CameraComponent mediaStream={mediaStream} stopCameraStream={stopCameraStream} />;
  }

  return (
    <div className={styles.cameraSection}>
      <ModalHeader closeModal={closeModal} title={title || t('addAttachment_title', 'Add Attachment')} />
      <ModalBody className={styles.modalBody}>
        <div className={styles.tabs}>
          <Tabs defaultSelectedIndex={view === 'camera' ? 0 : 1}>
            <TabList aria-label="Attachments-upload-section" className={styles.tabList}>
              <Tab disabled={!canCapturePhoto} onClick={() => setView('camera')}>
                {t('webcam', 'Webcam')}
              </Tab>
              <Tab onClick={() => setView('upload')}>{t('uploadFiles', 'Upload files')}</Tab>
            </TabList>
            <TabPanels>
              <TabPanel>
                {error ? (
                  <InlineNotification
                    subtitle={t(
                      'cameraAccessErrorMessage',
                      'Please enable camera access in your browser settings and try again.',
                    )}
                    title={t('cameraError', 'Camera error')}
                  />
                ) : null}
                {view === 'camera' && <CameraComponent mediaStream={mediaStream} stopCameraStream={stopCameraStream} />}
              </TabPanel>
              <TabPanel>
                <MediaUploaderComponent />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </div>
      </ModalBody>
    </div>
  );
};

export default CameraMediaUploaderModal;
