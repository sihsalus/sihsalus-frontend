import { Button, InlineLoading, ModalBody, ModalFooter, ModalHeader, TextArea } from '@carbon/react';
import { showSnackbar } from '@openmrs/esm-framework';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { fuaUpdatePrivilege } from '../constant';
import { cancelFuaRequest, type FuaRequest } from '../hooks/useFuaRequests';

import styles from './fua-modals.scss';

interface CancelFuaModalProps {
  closeModal: () => void;
  fuaRequest: FuaRequest;
  onCancelled?: () => void;
}

const CancelFuaModal: React.FC<CancelFuaModalProps> = ({ closeModal, fuaRequest, onCancelled }) => {
  const { t } = useTranslation();
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!comment.trim()) {
      showSnackbar({
        title: t('error', 'Error'),
        subtitle: t('commentRequired', 'Debe ingresar un motivo de cancelación'),
        kind: 'error',
      });
      return;
    }

    setIsSubmitting(true);
    const abortController = new AbortController();

    try {
      await cancelFuaRequest(fuaRequest.id, comment.trim(), abortController);

      showSnackbar({
        title: t('success', 'Éxito'),
        subtitle: t('fuaCancelledSuccessfully', 'El FUA se canceló correctamente'),
        kind: 'success',
      });

      onCancelled?.();
      closeModal();
    } catch {
      showSnackbar({
        title: t('error', 'Error'),
        subtitle: t('errorCancellingFua', 'Ocurrió un error al cancelar el FUA'),
        kind: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <RequirePrivilege privilege={fuaUpdatePrivilege}>
      <ModalHeader closeModal={closeModal} title={t('cancelFua', 'Cancelar FUA')} />
      <ModalBody>
        <div className={styles.modalContent}>
          <div className={styles.fuaInfo}>
            <p>
              <strong>{t('fuaName', 'Nombre del FUA')}:</strong> {fuaRequest.name || 'N/A'}
            </p>
            <p>
              <strong>{t('currentStatus', 'Estado Actual')}:</strong>{' '}
              {fuaRequest.fuaEstado?.nombre || t('noStatus', 'Sin estado')}
            </p>
          </div>

          <div className={styles.warningMessage}>
            <p>{t('cancelWarning', 'Esta acción no se puede deshacer. El FUA será cancelado permanentemente.')}</p>
          </div>

          <TextArea
            id="cancel-fua-comment"
            labelText={t('cancellationReason', 'Motivo de cancelación')}
            placeholder={t('enterCancellationReason', 'Ingrese el motivo por el cual desea cancelar este FUA...')}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            maxCount={500}
            disabled={isSubmitting}
          />
        </div>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeModal} disabled={isSubmitting}>
          {t('goBack', 'Volver')}
        </Button>
        <Button kind="danger" onClick={handleSubmit} disabled={isSubmitting || !comment.trim()}>
          {isSubmitting ? (
            <InlineLoading description={t('cancelling', 'Cancelando...')} />
          ) : (
            t('confirmCancel', 'Confirmar Cancelación')
          )}
        </Button>
      </ModalFooter>
    </RequirePrivilege>
  );
};

export default CancelFuaModal;
