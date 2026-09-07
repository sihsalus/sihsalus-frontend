import { FileUploaderDropContainer, InlineNotification } from '@carbon/react';
import { useConfig } from '@openmrs/esm-framework';
import { useCallback, useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { moduleName } from '../constants';
import { readFileAsString } from '../utils';
import CameraMediaUploaderContext from './camera-media-uploader-context.resources';
import styles from './media-uploader.scss';

interface ErrorNotification {
  title: string;
  subtitle: string;
}

export function isAllowedAttachmentFileName(fileName: string, allowedFileExtensions: Array<string>): boolean {
  const extensionSeparator = fileName.lastIndexOf('.');
  if (extensionSeparator <= 0 || extensionSeparator === fileName.length - 1 || !allowedFileExtensions.length) {
    return false;
  }

  const fileExtension = fileName.slice(extensionSeparator + 1).toLowerCase();
  return allowedFileExtensions.includes(fileExtension);
}

export function getEffectiveMaxFileSizeMb(configuredMaxFileSize: number, override?: number): number {
  return typeof override === 'number' && Number.isFinite(override) && override > 0 ? override : configuredMaxFileSize;
}

const MediaUploaderComponent = () => {
  const { t } = useTranslation(moduleName);
  const { maxFileSize: configuredMaxFileSize } = useConfig();
  const {
    allowedExtensions = [],
    maxFileSizeMb,
    setFilesToUpload,
    multipleFiles,
  } = useContext(CameraMediaUploaderContext);
  const maxFileSize = getEffectiveMaxFileSizeMb(configuredMaxFileSize, maxFileSizeMb);
  const [errorNotification, setErrorNotification] = useState<ErrorNotification | null>(null);
  const uploadsEnabled = allowedExtensions.length > 0;

  const upload = useCallback(
    (files: Array<File>) => {
      if (!uploadsEnabled) {
        setErrorNotification({
          title: t('attachmentUploadUnavailableTitle', 'Attachment upload unavailable'),
          subtitle: t(
            'attachmentUploadUnavailable',
            'No permitted attachment types have been configured. Contact the system administrator.',
          ),
        });
        return;
      }

      files.forEach((file) => {
        if (file.size > maxFileSize * 1024 * 1024) {
          setErrorNotification({
            title: t('fileSizeLimitExceededText', 'File size limit exceeded'),
            subtitle: `The file "${file.name}" ${t(
              'fileSizeLimitExceeded',
              'exceeds the size limit of',
            )} ${maxFileSize} MB.`,
          });
        } else if (!isAllowedAttachmentFileName(file.name, allowedExtensions)) {
          setErrorNotification({
            title: t('unsupportedFileType', 'Unsupported file type'),
            subtitle: t(
              'chooseAnAllowedFileType',
              'The file "{{fileName}}" cannot be uploaded. Use one of these permitted extensions: {{supportedExtensions}}.',
              {
                fileName: file.name,
                supportedExtensions: allowedExtensions.join(', '),
              },
            ),
          });
        } else {
          // Convert MBs to bytes
          readFileAsString(file).then((base64Content) => {
            setFilesToUpload((uriData) => [
              ...uriData,
              {
                base64Content,
                file,
                fileName: file.name,
                fileType:
                  file.type.split('/')[0] === 'image' ? 'image' : file.type.split('/')[1] === 'pdf' ? 'pdf' : 'other',
                fileDescription: '',
                status: 'uploading',
              },
            ]);
          });
        }
      });
    },
    [allowedExtensions, maxFileSize, setFilesToUpload, t, uploadsEnabled],
  );

  return (
    <div className="cds--file__container">
      {!uploadsEnabled && (
        <div className={styles.errorContainer}>
          <InlineNotification
            hideCloseButton
            kind="error"
            subtitle={t(
              'attachmentUploadUnavailable',
              'No permitted attachment types have been configured. Contact the system administrator.',
            )}
            title={t('attachmentUploadUnavailableTitle', 'Attachment upload unavailable')}
          />
        </div>
      )}
      {errorNotification && (
        <div className={styles.errorContainer}>
          <InlineNotification
            aria-label="Upload error notification"
            kind="error"
            onClose={() => setErrorNotification(null)}
            subtitle={errorNotification.subtitle}
            title={errorNotification.title}
          />
        </div>
      )}
      <p className="cds--label-description">
        {t('fileUploadSizeConstraints', 'Size limit is {{fileSize}}MB', {
          fileSize: maxFileSize,
        })}
        .{' '}
        {t('supportedFiletypes', 'Supported files are {{supportedFiles}}', {
          supportedFiles: allowedExtensions.join(', '),
        })}
        .
      </p>
      <div className={styles.uploadFile}>
        <FileUploaderDropContainer
          accept={allowedExtensions.map((extension) => `.${extension}`)}
          disabled={!uploadsEnabled}
          labelText={t('fileSizeInstructions', 'Drag and drop files here or click to upload')}
          tabIndex={0}
          multiple={multipleFiles}
          onAddFiles={(_evt, { addedFiles }) => {
            upload(addedFiles);
          }}
        />
      </div>
    </div>
  );
};

export default MediaUploaderComponent;
