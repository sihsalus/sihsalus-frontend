import { Button, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { showSnackbar } from '@openmrs/esm-framework';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { previewInstance } from '../../api';

interface InstancePreviewModalProps {
  closeInstancePreviewModal: () => void;
  studyId: number;
  orthancInstanceUID: string;
  instancePosition: string;
}

const InstancePreviewModal: React.FC<InstancePreviewModalProps> = ({
  closeInstancePreviewModal,
  studyId,
  orthancInstanceUID,
  instancePosition,
}) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [imageData, setImageData] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    previewInstance(orthancInstanceUID, studyId, new AbortController())
      .then(async (response) => {
        setImageData(URL.createObjectURL(await response.blob()));
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        showSnackbar({
          isLowContrast: false,
          kind: 'error',
          title: t('errorPreviewInstance', 'An error occurred while retrieving the instance preview'),
          subtitle: message,
        });
        closeInstancePreviewModal();
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [closeInstancePreviewModal, studyId, orthancInstanceUID, t]);

  return (
    <div className="instancePreviewDic" style={{ textAlign: 'center' }}>
      <ModalHeader
        closeModal={closeInstancePreviewModal}
        title={t('instancePreview', 'Preview the selected study instance')}
      />
      <ModalBody>
        <p style={{ marginBottom: '20px' }}>{t('instancePosition', 'Instance position') + ': ' + instancePosition}</p>
        {isLoading ? (
          t('loadingImage', 'Loading image')
        ) : imageData ? (
          <img
            alt={t('instancePreview', 'Preview the selected study instance')}
            src={imageData}
            width="340"
            height="300"
          />
        ) : (
          t('previewUnavailable', 'Preview unavailable')
        )}
      </ModalBody>

      <ModalFooter>
        <Button kind="secondary" onClick={closeInstancePreviewModal}>
          {t('close', 'Close')}
        </Button>
      </ModalFooter>
    </div>
  );
};

export default InstancePreviewModal;
