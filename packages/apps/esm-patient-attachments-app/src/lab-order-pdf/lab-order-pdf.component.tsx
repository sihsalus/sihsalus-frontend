import { Button, InlineLoading, InlineNotification } from '@carbon/react';
import { DocumentPdf, Upload } from '@carbon/react/icons';
import {
  attachmentUrl,
  createAttachment,
  type AttachmentResponse,
  formatDatetime,
  showModal,
  type UploadedFile,
  useConfig,
  useConnectivity,
  useSession,
  userHasAccess,
} from '@openmrs/esm-framework';
import type { Order } from '@openmrs/esm-patient-common-lib';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AttachmentsConfig } from '../attachments-config-schema';
import { moduleName } from '../constants';
import { getLabOrderPdfAttachments, getLabOrderPdfContext, getLabOrderPdfFilename } from './lab-order-pdf.resource';
import styles from './lab-order-pdf.scss';

interface LabOrderPdfProps {
  order: Order;
}

const maxLabOrderPdfSizeBytes = 5 * 1024 * 1024;

function isPdfUpload(file: UploadedFile): boolean {
  return Boolean(
    file.file &&
      file.file.size > 0 &&
      file.file.size <= maxLabOrderPdfSizeBytes &&
      file.fileName.toLowerCase().endsWith('.pdf') &&
      file.file.type.toLowerCase() === 'application/pdf',
  );
}

const EnabledLabOrderPdf: React.FC<LabOrderPdfProps> = ({ order }) => {
  const { t } = useTranslation(moduleName);
  const session = useSession();
  const isOnline = useConnectivity();
  const context = useMemo(() => getLabOrderPdfContext(order), [order]);
  const [attachments, setAttachments] = useState<Array<AttachmentResponse>>([]);
  const [error, setError] = useState(false);
  const [isContextVerified, setIsContextVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<AttachmentResponse | null>(null);
  const [revision, setRevision] = useState(0);
  const modalCloseRef = useRef<(() => void) | null>(null);
  const modalOpenRef = useRef(false);
  const uploadControllerRef = useRef<AbortController | null>(null);
  const fulfillerStatusRef = useRef(order.fulfillerStatus);
  const activeRef = useRef(true);
  fulfillerStatusRef.current = order.fulfillerStatus;

  const authenticatedUser = session?.authenticated ? session.user : undefined;
  const hasWorkflowAccess =
    userHasAccess('app:home.laboratorio', authenticatedUser) ||
    userHasAccess('app:hoja.clinica.ordenes', authenticatedUser);
  const canRead = Boolean(
    authenticatedUser && context && hasWorkflowAccess && userHasAccess('View Attachments', authenticatedUser),
  );
  const canUpload = Boolean(
    canRead &&
      isContextVerified &&
      isOnline &&
      order.fulfillerStatus === 'IN_PROGRESS' &&
      userHasAccess('app:home.laboratorio.editar', authenticatedUser) &&
      userHasAccess('Create Attachments', authenticatedUser) &&
      userHasAccess('Add Observations', authenticatedUser),
  );
  const uploadScope = context && authenticatedUser ? `${context.orderUuid}:${authenticatedUser.uuid}` : '';
  const readScope = context ? `${context.orderUuid}:${context.encounterUuid}:${context.patientUuid}:${revision}` : '';
  const uploadScopeRef = useRef(uploadScope);
  uploadScopeRef.current = uploadScope;

  useEffect(() => {
    if (!uploadScope) {
      return;
    }
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      modalOpenRef.current = false;
      modalCloseRef.current?.();
      modalCloseRef.current = null;
    };
  }, [uploadScope]);

  useEffect(() => {
    setPreview(null);
    setAttachments([]);
    setError(false);
    setIsContextVerified(false);

    if (!canRead || !readScope) {
      setIsLoading(false);
      return;
    }

    const abortController = new AbortController();
    setIsLoading(true);
    getLabOrderPdfAttachments(order, abortController)
      .then((documents) => {
        if (!abortController.signal.aborted) {
          setAttachments(documents);
          setIsContextVerified(true);
        }
      })
      .catch(() => {
        if (!abortController.signal.aborted) {
          setError(true);
        }
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => abortController.abort();
  }, [canRead, order, readScope]);

  const showAddPdfModal = useCallback(() => {
    if (!canUpload || !context || modalOpenRef.current || uploadControllerRef.current) {
      return;
    }

    modalOpenRef.current = true;
    let close = () => {};
    const closeModal = () => {
      // Do not cancel or hide an in-flight POST: its remote outcome would be
      // ambiguous. Completion releases the controller before closing here.
      if (uploadControllerRef.current || !modalOpenRef.current) {
        return;
      }
      modalOpenRef.current = false;
      modalCloseRef.current = null;
      close();
    };
    close = showModal('capture-photo-modal', {
      allowedExtensions: ['pdf'],
      closeModal,
      initialView: 'upload',
      maxFileSizeMb: 5,
      multipleFiles: false,
      onCompletion: () => {
        closeModal();
        if (activeRef.current && uploadScopeRef.current === uploadScope) {
          setRevision((value) => value + 1);
        }
      },
      saveFile: (file: UploadedFile) => {
        if (fulfillerStatusRef.current !== 'IN_PROGRESS') {
          return Promise.reject(
            new Error(
              t(
                'labOrderPdfOrderNotInProgress',
                'The laboratory order is no longer in progress. Reload its current status.',
              ),
            ),
          );
        }
        if (uploadControllerRef.current) {
          return Promise.reject(
            new Error(t('labOrderPdfUploadInProgress', 'A laboratory PDF upload is already in progress.')),
          );
        }
        if (!activeRef.current || !isPdfUpload(file)) {
          return Promise.reject(new Error(t('labOrderPdfInvalidFile', 'Only a valid PDF file can be attached.')));
        }

        const abortController = new AbortController();
        uploadControllerRef.current = abortController;
        return createAttachment(
          context.patientUuid,
          {
            ...file,
            fileDescription: t('labOrderPdfDescription', 'Supplemental laboratory PDF'),
            fileName: getLabOrderPdfFilename(context.orderUuid),
          },
          abortController.signal,
          {
            encounterUuid: context.encounterUuid,
            formFieldNamespace: context.formFieldNamespace,
            formFieldPath: context.formFieldPath,
          },
        )
          .catch(() => {
            throw new Error(t('labOrderPdfUploadFailed', 'The PDF could not be attached. Try again.'));
          })
          .finally(() => {
            if (uploadControllerRef.current === abortController) {
              uploadControllerRef.current = null;
            }
          });
      },
      skipConfiguredAllowlistLookup: true,
      title: t('labOrderPdfAdd', 'Attach laboratory PDF'),
    });
    modalCloseRef.current = close;
  }, [canUpload, context, t, uploadScope]);

  const getDocumentLabel = useCallback(
    (attachment: AttachmentResponse) => {
      const uploadedAt = new Date(attachment.dateTime);
      return Number.isNaN(uploadedAt.valueOf())
        ? t('labOrderPdfDocument', 'Laboratory PDF')
        : t('labOrderPdfDocumentWithDate', 'Laboratory PDF — {{date}}', {
            date: formatDatetime(uploadedAt),
          });
    },
    [t],
  );

  if (!canRead) {
    return null;
  }

  return (
    <section className={styles.container} aria-labelledby={`lab-order-pdf-${context.orderUuid}`}>
      <div className={styles.header}>
        <h5 id={`lab-order-pdf-${context.orderUuid}`}>{t('labOrderPdfTitle', 'Supplemental laboratory PDFs')}</h5>
        {canUpload && (
          <Button kind="ghost" onClick={showAddPdfModal} renderIcon={Upload} size="sm">
            {t('labOrderPdfAdd', 'Attach laboratory PDF')}
          </Button>
        )}
      </div>

      {!isOnline && (
        <InlineNotification
          hideCloseButton
          kind="info"
          lowContrast
          title={t('labOrderPdfOfflineTitle', 'PDF upload unavailable offline')}
          subtitle={t('labOrderPdfOffline', 'Reconnect to attach a document.')}
        />
      )}
      {isLoading && <InlineLoading description={t('labOrderPdfLoading', 'Loading attached PDFs')} />}
      {error && (
        <InlineNotification
          hideCloseButton
          kind="error"
          lowContrast
          title={t('labOrderPdfReadFailedTitle', 'PDFs could not be loaded')}
          subtitle={t('labOrderPdfReadFailed', 'Reload the page or contact the system administrator.')}
        />
      )}
      {!isLoading && !error && attachments.length === 0 && (
        <p className={styles.empty}>{t('labOrderPdfEmpty', 'No supplemental PDF is attached to this order.')}</p>
      )}
      {!error && attachments.length > 0 && (
        <ul className={styles.list}>
          {attachments.map((attachment) => (
            <li key={attachment.uuid}>
              <Button kind="ghost" onClick={() => setPreview(attachment)} renderIcon={DocumentPdf} size="sm">
                {getDocumentLabel(attachment)}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {preview && (
        <div className={styles.preview}>
          <div className={styles.previewHeader}>
            <span>{getDocumentLabel(preview)}</span>
            <Button kind="ghost" size="sm" onClick={() => setPreview(null)}>
              {t('closePreview', 'Close preview')}
            </Button>
          </div>
          <iframe
            referrerPolicy="no-referrer"
            sandbox=""
            src={`${window.openmrsBase}${attachmentUrl}/${preview.uuid}/bytes`}
            title={t('labOrderPdfPreview', 'Laboratory PDF preview')}
          />
        </div>
      )}
    </section>
  );
};

const LabOrderPdf: React.FC<LabOrderPdfProps> = (props) => {
  const { enableLabOrderPdfAttachments } = useConfig<AttachmentsConfig>();

  return enableLabOrderPdfAttachments === true ? <EnabledLabOrderPdf {...props} /> : null;
};

export default LabOrderPdf;
