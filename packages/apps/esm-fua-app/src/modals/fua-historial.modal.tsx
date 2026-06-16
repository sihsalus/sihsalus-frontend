import { Button, InlineNotification, ModalBody, ModalFooter, ModalHeader, SkeletonText, Tag } from '@carbon/react';
import { formatDate } from '@openmrs/esm-framework';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { fuaReadPrivilege } from '../constant';
import { useFuaHistorial } from '../hooks/useFuaHistorial';
import type { FuaRequest } from '../hooks/useFuaRequests';

import styles from './fua-modals.scss';

interface FuaHistorialModalProps {
  closeModal: () => void;
  fuaRequest: FuaRequest;
}

const ESTADO_TAG: Record<string, 'blue' | 'cyan' | 'gray' | 'green' | 'magenta' | 'red'> = {
  Pendiente: 'gray',
  'En Proceso': 'blue',
  Completado: 'green',
  'Enviado a SETI-SIS': 'cyan',
  Rechazado: 'red',
  Cancelado: 'magenta',
};

const FuaHistorialModalContent: React.FC<FuaHistorialModalProps> = ({ closeModal, fuaRequest }) => {
  const { t } = useTranslation();
  const { historial, isLoading, error } = useFuaHistorial(fuaRequest.id);

  return (
    <>
      <ModalHeader closeModal={closeModal} title={t('statusHistory', 'Historial de cambios de estado')} />
      <ModalBody>
        <div className={styles.modalContent}>
          <div className={styles.fuaInfo}>
            <p>
              <strong>{t('fuaName', 'Nombre del FUA')}:</strong> {fuaRequest.name || 'N/A'}
            </p>
          </div>

          {isLoading && <SkeletonText paragraph lineCount={4} />}

          {error && (
            <InlineNotification
              kind="error"
              title={t('errorLoadingHistorial', 'Error al cargar historial')}
              subtitle={error?.message}
              hideCloseButton
            />
          )}

          {!isLoading && !error && historial.length === 0 && (
            <p className={styles.noTransitions}>{t('noHistorialFound', 'No hay registros de cambios de estado')}</p>
          )}

          {!isLoading && historial.length > 0 && (
            <ol className={styles.historialList}>
              {historial.map((entry) => (
                <li key={entry.id} className={styles.historialEntry}>
                  <div className={styles.historialHeader}>
                    <Tag type={ESTADO_TAG[entry.estadoNombre] ?? 'gray'} size="sm">
                      {entry.estadoNombre}
                    </Tag>
                    <span className={styles.historialDate}>
                      {formatDate(new Date(entry.fecha), { mode: 'standard', time: true })}
                    </span>
                  </div>
                  <div className={styles.historialUser}>
                    <strong>{t('user', 'Usuario')}:</strong> {entry.usuario}
                  </div>
                  {entry.comentario && (
                    <div className={styles.historialComment}>
                      <strong>{t('comment', 'Comentario')}:</strong> {entry.comentario}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button kind="primary" onClick={closeModal}>
          {t('close', 'Cerrar')}
        </Button>
      </ModalFooter>
    </>
  );
};

const FuaHistorialModal: React.FC<FuaHistorialModalProps> = (props) => (
  <RequirePrivilege privilege={fuaReadPrivilege}>
    <FuaHistorialModalContent {...props} />
  </RequirePrivilege>
);

export default FuaHistorialModal;
