/** @module @category UI */

import { ActionableNotification, Button, FeatureFlags } from '@carbon/react';
import { getCoreTranslation } from '@openmrs/esm-translations';
import React, { useCallback, useState } from 'react';
import { NotificationDetailsModal, type NotificationDetailsSection } from './notification-details.modal';
import styles from './toast.module.scss';

const toastPreviewCharacterLimit = 160;

function getToastPreview(description: React.ReactNode) {
  if (typeof description !== 'string' || description.length <= toastPreviewCharacterLimit) {
    return { isTruncated: false, preview: description };
  }

  const candidate = description.slice(0, toastPreviewCharacterLimit + 1);
  const lastSpace = candidate.lastIndexOf(' ');
  const cutoff = lastSpace > toastPreviewCharacterLimit * 0.75 ? lastSpace : toastPreviewCharacterLimit;

  return {
    isTruncated: true,
    preview: `${description.slice(0, cutoff).trimEnd()}…`,
  };
}

export interface ToastProps {
  toast: ToastNotificationMeta;
  closeToast(): void;
}

export interface ToastDescriptor {
  description: React.ReactNode;
  details?: Array<NotificationDetailsSection>;
  onActionButtonClick?: () => void;
  actionButtonLabel?: string;
  kind?: ToastType;
  critical?: boolean;
  title?: string;
}

export interface ToastNotificationMeta extends ToastDescriptor {
  id: number;
}

export type ToastType = 'error' | 'info' | 'info-square' | 'success' | 'warning' | 'warning-alt';

export const Toast: React.FC<ToastProps> = ({ toast, closeToast }) => {
  const { description, details, kind, critical, title, actionButtonLabel, onActionButtonClick = () => {} } = toast;
  const [showDetails, setShowDetails] = useState(false);
  const { isTruncated, preview } = getToastPreview(description);
  const handleActionClick = useCallback(() => {
    onActionButtonClick();
    closeToast();
  }, [closeToast, onActionButtonClick]);

  const previewContent = isTruncated ? (
    <div className={styles.preview}>
      <span>{preview}</span>
      <Button className={styles.detailsButton} kind="ghost" size="sm" onClick={() => setShowDetails(true)}>
        {getCoreTranslation('showMore', 'Show more')}
      </Button>
    </div>
  ) : (
    description
  );

  return (
    <FeatureFlags enableFocusWrapWithoutSentinels>
      <div>
        <ActionableNotification
          actionButtonLabel={actionButtonLabel}
          kind={kind || 'info'}
          lowContrast={critical}
          subtitle={previewContent}
          title={title || ''}
          onActionButtonClick={handleActionClick}
          onClose={closeToast}
        />
        {isTruncated && showDetails ? (
          <NotificationDetailsModal
            description={description}
            sections={details}
            kind={kind}
            open
            title={title || getCoreTranslation('additionalDetails', 'Additional details')}
            onClose={() => setShowDetails(false)}
          />
        ) : null}
      </div>
    </FeatureFlags>
  );
};
