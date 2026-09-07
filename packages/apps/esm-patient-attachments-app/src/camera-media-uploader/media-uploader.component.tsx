import { FileUploaderDropContainer, InlineLoading, InlineNotification } from '@carbon/react';
import { type UploadedFile, useConfig } from '@openmrs/esm-framework';
import { type DragEvent, useCallback, useContext, useEffect, useRef, useState } from 'react';
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
  const [isReading, setIsReading] = useState(false);
  const readingRef = useRef(false);
  const activeRef = useRef(true);
  const uploadsEnabled = allowedExtensions.length > 0;

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);

  const upload = useCallback(
    async (files: Array<File>) => {
      if (readingRef.current || files.length === 0) {
        return;
      }
      setErrorNotification(null);
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

      if (!multipleFiles && files.length > 1) {
        setErrorNotification({
          title: t('uploadError', 'Error uploading file'),
          subtitle: t('singleAttachmentOnly', 'Select one file at a time for this attachment.'),
        });
        return;
      }

      for (const file of files) {
        if (file.size > maxFileSize * 1024 * 1024) {
          setErrorNotification({
            title: t('fileSizeLimitExceededText', 'File size limit exceeded'),
            subtitle: t(
              'attachmentFileTooLarge',
              'The file "{{fileName}}" exceeds the size limit of {{fileSize}} MB.',
              {
                fileName: file.name,
                fileSize: maxFileSize,
              },
            ),
          });
          return;
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
          return;
        }
      }

      readingRef.current = true;
      setIsReading(true);
      try {
        const batch = await Promise.all(
          files.map(
            async (file): Promise<UploadedFile> => ({
              base64Content: await readFileAsString(file),
              file,
              fileName: file.name,
              fileType:
                file.type.split('/')[0] === 'image' ? 'image' : file.type.split('/')[1] === 'pdf' ? 'pdf' : 'other',
              fileDescription: '',
              status: 'uploading',
            }),
          ),
        );
        if (activeRef.current) {
          // Publish the entire selection together: the parent opens review on the first state update.
          setFilesToUpload((previousFiles) => [...previousFiles, ...batch]);
        }
      } catch {
        if (activeRef.current) {
          setErrorNotification({
            title: t('attachmentReadFailedTitle', 'Files could not be read'),
            subtitle: t(
              'attachmentReadFailed',
              'No files were added. Check that the selected files can be opened and select them again.',
            ),
          });
        }
      } finally {
        readingRef.current = false;
        if (activeRef.current) {
          setIsReading(false);
        }
      }
    },
    [allowedExtensions, maxFileSize, multipleFiles, setFilesToUpload, t, uploadsEnabled],
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
      {multipleFiles && (
        <p className="cds--label-description">
          {t(
            'attachmentBatchInstructions',
            'You can select several files together, then review each file before uploading.',
          )}
        </p>
      )}
      {isReading && <InlineLoading description={t('attachmentReadingFiles', 'Preparing selected files')} />}
      <div className={styles.uploadFile}>
        <FileUploaderDropContainer
          accept={allowedExtensions.map((extension) => `.${extension}`)}
          disabled={!uploadsEnabled || isReading}
          labelText={t('fileSizeInstructions', 'Drag and drop files here or click to upload')}
          tabIndex={0}
          multiple={multipleFiles}
          onAddFiles={(event, { addedFiles }) => {
            // Carbon can truncate single-file drops or omit extensionless files before this callback.
            const selectedFiles =
              event.target instanceof HTMLInputElement
                ? event.target.files
                : (event as DragEvent<HTMLElement>).dataTransfer?.files;
            upload(selectedFiles?.length ? Array.from(selectedFiles) : addedFiles);
          }}
        />
      </div>
    </div>
  );
};

export default MediaUploaderComponent;
