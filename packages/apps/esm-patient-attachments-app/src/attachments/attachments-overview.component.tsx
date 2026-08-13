import { Button, ContentSwitcher, DataTableSkeleton, IconSwitch, InlineNotification, Loading } from '@carbon/react';
import { List, Thumbnail_2 } from '@carbon/react/icons';
import {
  AddIcon,
  type Attachment,
  createAttachment,
  deleteAttachmentPermanently,
  getAttachmentErrorStatus,
  showModal,
  showSnackbar,
  type UploadedFile,
  useAttachments,
  useLayoutType,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import { CardHeader, EmptyState, ErrorState, useAllowedFileExtensions } from '@openmrs/esm-patient-common-lib';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { moduleName } from '../constants';
import { createGalleryEntry } from '../utils';
import AttachmentPreview from './attachment-preview.component';
import AttachmentsGridOverview from './attachments-grid-overview.component';
import styles from './attachments-overview.scss';
import AttachmentsTableOverview from './attachments-table-overview.component';

interface AttachmentsOverviewProps {
  patientUuid: string;
}

interface SwitchEventHandlersParams {
  index?: number;
  name?: string | number;
  text?: string;
  key?: string | number;
}

type ViewType = 'grid' | 'table';

export function canDisplayCachedAttachments(error: unknown): boolean {
  const status = getAttachmentErrorStatus(error);

  if (status !== undefined) {
    return status === 408 || status === 425 || status === 429 || status >= 500;
  }

  return (
    error instanceof TypeError ||
    (error instanceof Error &&
      (['AbortError', 'NetworkError', 'TimeoutError'].includes(error.name) ||
        /failed to fetch|load failed|network request failed/i.test(error.message)))
  );
}

const AttachmentsOverview: React.FC<AttachmentsOverviewProps> = ({ patientUuid }) => {
  const isTablet = useLayoutType() === 'tablet';
  const { t } = useTranslation(moduleName);
  const session = useSession();
  // The backend may omit sessionId from /session (newer webservices.rest strips
  // it). Cached data still gets isolated per user; when a session id is present
  // it narrows the scope further. Rendering must not depend on sessionId.
  const attachmentCacheScope =
    session?.authenticated && session.user?.uuid
      ? `${session.sessionId ?? 'no-session-id'}:${session.user.uuid}`
      : undefined;
  const canRead = Boolean(attachmentCacheScope && userHasAccess('app:hoja.clinica.adjuntos', session?.user));
  const canEdit = Boolean(attachmentCacheScope && userHasAccess('app:hoja.clinica.adjuntos.editar', session?.user));
  const { data, error, mutate, isValidating, isLoading } = useAttachments(
    patientUuid,
    true,
    canRead,
    attachmentCacheScope,
  );
  const {
    allowedFileExtensions,
    error: attachmentConfigurationError,
    isConfigured: isAttachmentUploadConfigured,
    isLoading: isAttachmentConfigurationLoading,
  } = useAllowedFileExtensions();

  const [attachmentPreview, setAttachmentToPreview] = useState<{
    attachment: Attachment;
    cacheScope: string;
    patientUuid: string;
  } | null>(null);
  const [hasUploadError, setHasUploadError] = useState(false);
  const [view, setView] = useState<ViewType>('grid');

  const headerTitle = t('attachmentsInProperFormat', 'Attachments');
  const attachments = useMemo(() => data.map((item) => createGalleryEntry(item)), [data]);
  const canDisplayCachedData = error ? canDisplayCachedAttachments(error) : true;
  const attachmentToPreview =
    attachmentPreview?.patientUuid === patientUuid && attachmentPreview.cacheScope === attachmentCacheScope
      ? attachmentPreview.attachment
      : null;
  const closeImageOrPdfPreview = useCallback(() => setAttachmentToPreview(null), []);

  useEffect(() => {
    if (
      attachmentPreview &&
      (!canRead ||
        attachmentPreview.patientUuid !== patientUuid ||
        attachmentPreview.cacheScope !== attachmentCacheScope ||
        (error && !canDisplayCachedData))
    ) {
      setAttachmentToPreview(null);
    }
  }, [attachmentCacheScope, attachmentPreview, canDisplayCachedData, canRead, error, patientUuid]);

  useEffect(() => {
    if (hasUploadError) {
      showSnackbar({
        isLowContrast: true,
        kind: 'error',
        subtitle: t('unsupportedFileType', 'Unsupported file type'),
        title: t('uploadError', 'Error uploading file'),
      });
      setHasUploadError(false);
    }
  }, [hasUploadError, t]);

  const deleteAttachment = useCallback(
    (attachment: Attachment) => {
      deleteAttachmentPermanently(attachment.id, new AbortController())
        .then(() => {
          mutate();
          setAttachmentToPreview(null);

          showSnackbar({
            title: t('fileDeleted', 'File deleted'),
            subtitle: `${attachment.filename} ${t('successfullyDeleted', 'successfully deleted')}`,
            kind: 'success',
            isLowContrast: true,
          });
        })
        .catch(() => {
          showSnackbar({
            title: t('error', 'Error'),
            subtitle: `${attachment.filename} ${t('failedDeleting', "couldn't be deleted")}`,
            kind: 'error',
          });
        });
    },
    [mutate, t],
  );

  const openAttachment = useCallback(
    (attachment: Attachment) => {
      if (attachment.bytesContentFamily === 'IMAGE' || attachment.bytesContentFamily === 'PDF') {
        if (!attachmentCacheScope) {
          return;
        }
        setAttachmentToPreview({ attachment, cacheScope: attachmentCacheScope, patientUuid });
      } else {
        const anchor = document.createElement('a');
        anchor.setAttribute('href', attachment.src);
        anchor.setAttribute('download', attachment.filename);
        anchor.click();
      }
    },
    [attachmentCacheScope, patientUuid],
  );

  const showAddAttachmentModal = useCallback(() => {
    if (!canEdit) {
      return;
    }

    if (isAttachmentConfigurationLoading) {
      showSnackbar({
        isLowContrast: true,
        kind: 'info',
        subtitle: t('attachmentConfigurationLoading', 'Loading the permitted attachment types.'),
        title: t('attachmentConfigurationLoadingTitle', 'Checking attachment configuration'),
      });
      return;
    }

    if (attachmentConfigurationError || !isAttachmentUploadConfigured) {
      showSnackbar({
        isLowContrast: true,
        kind: 'error',
        subtitle: t(
          'attachmentUploadUnavailable',
          'No permitted attachment types have been configured. Contact the system administrator.',
        ),
        title: t('attachmentUploadUnavailableTitle', 'Attachment upload unavailable'),
      });
      return;
    }

    const close = showModal('capture-photo-modal', {
      saveFile: (file: UploadedFile) => {
        if (file.capturedFromWebcam && !file.fileName.includes('.')) {
          file.fileName = `${file.fileName}.png`;
        }
        return createAttachment(patientUuid, file);
      },
      allowedExtensions: allowedFileExtensions,
      closeModal: () => close(),
      onCompletion: () => mutate(),
      multipleFiles: true,
      collectDescription: true,
    });
  }, [
    allowedFileExtensions,
    attachmentConfigurationError,
    canEdit,
    isAttachmentConfigurationLoading,
    isAttachmentUploadConfigured,
    mutate,
    patientUuid,
    t,
  ]);

  const showDeleteAttachmentModal = useCallback(
    (attachment: Attachment) => {
      if (!canEdit) {
        return;
      }
      const close = showModal('delete-attachment-modal', {
        attachment: attachment,
        close: () => close(),
        onConfirmation: (attachment) => {
          deleteAttachment(attachment);
          close();
        },
      });
    },
    [canEdit, deleteAttachment],
  );

  if (!canRead) {
    return null;
  }

  if (isLoading) {
    return <DataTableSkeleton role="progressbar" />;
  }

  if (error && (!attachments.length || !canDisplayCachedData)) {
    return <ErrorState error={error} headerTitle={headerTitle} />;
  }

  if (!attachments.length) {
    return (
      <EmptyState
        displayText={t('attachmentsInLowerCase', 'attachments')}
        headerTitle={headerTitle}
        launchForm={canEdit ? showAddAttachmentModal : undefined}
      />
    );
  }

  return (
    <>
      <div onDragOverCapture={canEdit ? showAddAttachmentModal : undefined} className={styles.overview}>
        <>
          <CardHeader title={headerTitle}>
            <div className={styles.validatingDataIcon}>{isValidating && <Loading withOverlay={false} small />}</div>
            <div className={styles.attachmentHeaderActionItems}>
              <ContentSwitcher
                onChange={(event: SwitchEventHandlersParams) => setView(event.name.toString() as ViewType)}
                selectedIndex={view === 'grid' ? 0 : 1}
                size={isTablet ? 'md' : 'sm'}
              >
                <IconSwitch name="grid" text={t('gridView', 'Grid view')}>
                  <Thumbnail_2 size={16} />
                </IconSwitch>
                <IconSwitch name="table" text={t('tableView', 'Table view')}>
                  <List size={16} />
                </IconSwitch>
              </ContentSwitcher>
              <div className={styles.divider} />
              {canEdit ? (
                <Button
                  kind="ghost"
                  renderIcon={AddIcon}
                  iconDescription="Add attachment"
                  onClick={showAddAttachmentModal}
                >
                  {t('add', 'Add')}
                </Button>
              ) : null}
            </div>
          </CardHeader>
          {error ? (
            <InlineNotification
              hideCloseButton
              kind="warning"
              lowContrast
              style={{ margin: 0, minWidth: '100%' }}
              subtitle={t(
                'staleAttachmentsWarning',
                'The latest attachments could not be loaded. This list may be out of date.',
              )}
              title={t('staleAttachmentsWarningTitle', 'Showing saved attachments')}
            />
          ) : null}
          {view === 'grid' ? (
            <AttachmentsGridOverview
              attachments={attachments}
              isLoading={isLoading}
              onOpenAttachment={openAttachment}
            />
          ) : (
            <AttachmentsTableOverview
              attachments={attachments}
              isLoading={isLoading}
              onDeleteAttachment={showDeleteAttachmentModal}
              onOpenAttachment={openAttachment}
            />
          )}
        </>
      </div>
      {attachmentToPreview && (
        <AttachmentPreview
          key={attachmentToPreview.id}
          attachmentToPreview={attachmentToPreview}
          onClosePreview={closeImageOrPdfPreview}
          onDeleteAttachment={showDeleteAttachmentModal}
        />
      )}
    </>
  );
};

export default AttachmentsOverview;
