import { Button } from '@carbon/react';
import { Camera, TrashCan, Upload } from '@carbon/react/icons';
import { showModal, toOmrsIsoString, type UploadedFile, useLayoutType } from '@openmrs/esm-framework';
import classNames from 'classnames';
import React, { type ComponentProps, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type CameraMediaUploadView } from './camera-media-uploader-types';
import styles from './capture-photo.scss';

export interface CapturePhotoProps {
  onCapturePhoto(dataUri: string, photoDateTime: string): void;
  onClearPhoto?(): void;
  initialState?: string;
}

const CapturePhoto: React.FC<CapturePhotoProps> = ({ initialState, onCapturePhoto, onClearPhoto }) => {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const responsiveSize = isTablet ? 'lg' : 'sm';
  const [dataUri, setDataUri] = useState<string | null>(null);

  const openPhotoModal = useCallback(
    (initialView: CameraMediaUploadView) => {
      const close = showModal('capture-photo-modal', {
        saveFile(file: UploadedFile) {
          return Promise.resolve().then(() => {
            setDataUri(file.base64Content);
            onCapturePhoto(file.base64Content, toOmrsIsoString(new Date()));
            close();
          });
        },
        collectDescription: false,
        closeModal: () => {
          close();
        },
        initialView,
        title: initialView === 'camera' ? t('takePhoto', 'Take photo') : t('addAnImage', 'Add image'),
      });
    },
    [onCapturePhoto, t],
  );

  const handleClearPhoto = useCallback(() => {
    setDataUri(null);
    onClearPhoto?.();
  }, [onClearPhoto]);

  const showEmptyState = !dataUri && !initialState;

  return (
    <>
      <div className={styles.imageContainer}>
        {showEmptyState ? (
          <span className={styles.emptyState}>{t('noImageToDisplay', 'No image to display')}</span>
        ) : (
          <img
            alt={t('imagePreview', 'Image preview')}
            className={classNames({
              [styles.imagePreview]: !showEmptyState,
              [styles.altImagePreview]: showEmptyState,
            })}
            src={dataUri || initialState}
          />
        )}
      </div>
      <div className={styles.buttonContainer}>
        <Button
          className={styles.actionButton}
          kind="secondary"
          onClick={() => openPhotoModal('camera')}
          renderIcon={(props: ComponentProps<typeof Camera>) => <Camera {...props} />}
          size={responsiveSize}
        >
          {t('takePhoto', 'Take photo')}
        </Button>
        <Button
          className={styles.actionButton}
          kind="tertiary"
          onClick={() => openPhotoModal('upload')}
          renderIcon={(props: ComponentProps<typeof Upload>) => <Upload {...props} />}
          size={responsiveSize}
        >
          {t('uploadImage', 'Upload image')}
        </Button>
        {dataUri ? (
          <Button
            className={styles.actionButton}
            kind="ghost"
            onClick={handleClearPhoto}
            renderIcon={(props: ComponentProps<typeof TrashCan>) => <TrashCan {...props} />}
            size={responsiveSize}
          >
            {t('clearSelectedImage', 'Clear')}
          </Button>
        ) : null}
      </div>
    </>
  );
};

export default CapturePhoto;
