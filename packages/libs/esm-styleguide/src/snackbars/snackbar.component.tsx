/** @module @category UI */

import { ActionableNotification, Button } from '@carbon/react';
import { getCoreTranslation } from '@openmrs/esm-translations';
import classnames from 'classnames';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import styles from './snackbar.module.scss';
import {
  NotificationDetailsModal,
  type NotificationDetailsSection,
} from '../toasts/notification-details.modal';

// Design documentation for Snackbars https://zeroheight.com/23a080e38/p/683580-notifications/t/468baf
export interface SnackbarProps {
  snackbar: SnackbarMeta;
  closeSnackbar(): void;
}

export interface SnackbarDescriptor {
  actionButtonLabel?: string;
  isLowContrast?: boolean;
  kind?: SnackbarType | string;
  onActionButtonClick?: () => void;
  progressActionLabel?: string;
  subtitle?: React.ReactNode;
  timeoutInMs?: number;
  autoClose?: boolean;
  details?: Array<NotificationDetailsSection>;
  title: string;
}

export interface SnackbarMeta extends SnackbarDescriptor {
  id: number;
}

export type SnackbarType = 'error' | 'info' | 'info-square' | 'success' | 'warning' | 'warning-alt';

const snackbarPreviewCharacterLimit = 160;

function getSnackbarPreview(subtitle: React.ReactNode) {
  if (typeof subtitle !== 'string' || subtitle.length <= snackbarPreviewCharacterLimit) {
    return { isTruncated: false, preview: subtitle };
  }

  const candidate = subtitle.slice(0, snackbarPreviewCharacterLimit + 1);
  const lastSpace = candidate.lastIndexOf(' ');
  const cutoff = lastSpace > snackbarPreviewCharacterLimit * 0.75 ? lastSpace : snackbarPreviewCharacterLimit;

  return { isTruncated: true, preview: `${subtitle.slice(0, cutoff).trimEnd()}...` };
}

export const Snackbar: React.FC<SnackbarProps> = ({ snackbar, closeSnackbar: removeSnackBarFromDom }) => {
  const {
    actionButtonLabel = '',
    kind = 'success',
    onActionButtonClick = () => {},
    isLowContrast = kind !== 'error',
    progressActionLabel,
    subtitle = '',
    timeoutInMs,
    autoClose = true,
    details,
    title,
    id,
    ...props
  } = snackbar;
  const effectiveTimeoutInMs = timeoutInMs ?? (kind === 'error' ? 8000 : 5000);

  const [actionText, setActionText] = useState(actionButtonLabel);
  const [applyAnimation, setApplyAnimation] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const { isTruncated, preview } = getSnackbarPreview(subtitle);
  const removeSnackBarFromDomRef = useRef(removeSnackBarFromDom);

  useEffect(() => {
    removeSnackBarFromDomRef.current = removeSnackBarFromDom;
  }, [removeSnackBarFromDom]);

  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeSnackbar = useCallback(() => {
    // This is to add a slide out animation before closing the snackbar
    // The animation lasts for 250ms, thus the timeout
    closeTimeoutRef.current = setTimeout(() => removeSnackBarFromDomRef.current(), 250);
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const onCloseSnackbar = useCallback(() => {
    setIsClosing(true);
    closeSnackbar();
  }, [closeSnackbar]);

  const handleActionClick = () => {
    onActionButtonClick();
    onCloseSnackbar();
    if (progressActionLabel) {
      setActionText(progressActionLabel);
    }
  };

  useEffect(() => {
    if (autoClose && !showDetails) {
      const timeoutId = setTimeout(onCloseSnackbar, effectiveTimeoutInMs);
      return () => clearTimeout(timeoutId);
    }
  }, [effectiveTimeoutInMs, autoClose, onCloseSnackbar, showDetails]);

  useEffect(() => {
    setApplyAnimation(false);

    window.setTimeout(() => {
      setApplyAnimation(true);
    }, 0);
  }, []);

  const previewContent = isTruncated ? (
    <div className={styles.preview}>
      <span>{preview}</span>
      <Button className={styles.detailsButton} kind="ghost" size="sm" onClick={() => setShowDetails(true)}>
        {getCoreTranslation('showMore', 'Show more')}
      </Button>
    </div>
  ) : (
    subtitle
  );

  return (
    <>
      <ActionableNotification
        actionButtonLabel={actionText}
        aria-label={getCoreTranslation('closeSnackbar', 'Close snackbar')}
        className={classnames(styles.slideIn, {
          [styles.animated]: applyAnimation,
          [styles.slideOut]: isClosing,
        })}
        kind={kind as SnackbarType}
        lowContrast={isLowContrast}
        onActionButtonClick={handleActionClick}
        onClose={onCloseSnackbar}
        statusIconDescription={getCoreTranslation('snackbarNotification', 'Snackbar notification')}
        subtitle={previewContent}
        title={title}
        {...props}
      />
      {isTruncated && showDetails ? (
        <NotificationDetailsModal
          description={subtitle}
          sections={details}
          kind={kind}
          open
          title={title}
          onClose={() => setShowDetails(false)}
        />
      ) : null}
    </>
  );
};
