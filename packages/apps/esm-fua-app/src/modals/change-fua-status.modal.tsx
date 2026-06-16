import { Button, InlineLoading, ModalBody, ModalFooter, ModalHeader, Select, SelectItem } from '@carbon/react';
import { showSnackbar } from '@openmrs/esm-framework';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { fuaUpdatePrivilege } from '../constant';
import { type FuaRequest, setFuaEstado } from '../hooks/useFuaRequests';

import styles from './fua-modals.scss';

interface ChangeFuaStatusModalProps {
  closeModal: () => void;
  fuaRequest: FuaRequest;
  onStatusChanged?: () => void;
}

// Estados disponibles del FUA según el flujo de SETI-SIS
// CANCELADO (id=6) requiere soporte en el OMOD (fua_estado tabla)
export const FUA_ESTADOS = {
  PENDIENTE: { id: 1, nombre: 'Pendiente' },
  EN_PROCESO: { id: 2, nombre: 'En Proceso' },
  COMPLETADO: { id: 3, nombre: 'Completado' },
  ENVIADO: { id: 4, nombre: 'Enviado a SETI-SIS' },
  RECHAZADO: { id: 5, nombre: 'Rechazado' },
  CANCELADO: { id: 6, nombre: 'Cancelado' },
} as const;

const ChangeFuaStatusModal: React.FC<ChangeFuaStatusModalProps> = ({ closeModal, fuaRequest, onStatusChanged }) => {
  const { t } = useTranslation();
  const [selectedEstadoId, setSelectedEstadoId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentEstadoId = fuaRequest.fuaEstado?.id;

  // Filtrar estados disponibles según el estado actual (flujo de workflow)
  const getAvailableEstados = useCallback(() => {
    const allEstados = Object.values(FUA_ESTADOS);

    // Si no tiene estado, puede ir a Pendiente o En Proceso
    if (!currentEstadoId) {
      return allEstados.filter((e) => e.id === FUA_ESTADOS.PENDIENTE.id || e.id === FUA_ESTADOS.EN_PROCESO.id);
    }

    // Definir transiciones válidas
    const transitions: Record<number, number[]> = {
      [FUA_ESTADOS.PENDIENTE.id]: [FUA_ESTADOS.EN_PROCESO.id, FUA_ESTADOS.CANCELADO.id],
      [FUA_ESTADOS.EN_PROCESO.id]: [FUA_ESTADOS.COMPLETADO.id, FUA_ESTADOS.CANCELADO.id],
      [FUA_ESTADOS.COMPLETADO.id]: [FUA_ESTADOS.ENVIADO.id, FUA_ESTADOS.CANCELADO.id],
      [FUA_ESTADOS.ENVIADO.id]: [FUA_ESTADOS.RECHAZADO.id], // SETI-SIS puede rechazar
      [FUA_ESTADOS.RECHAZADO.id]: [FUA_ESTADOS.PENDIENTE.id], // Puede corregir y reenviar
      [FUA_ESTADOS.CANCELADO.id]: [], // Estado final
    };

    const validTransitions = transitions[currentEstadoId] || [];
    return allEstados.filter((e) => validTransitions.includes(e.id));
  }, [currentEstadoId]);

  const availableEstados = getAvailableEstados();

  const handleSubmit = async () => {
    if (!selectedEstadoId) {
      showSnackbar({
        title: t('error', 'Error'),
        subtitle: t('selectStatus', 'Debe seleccionar un estado'),
        kind: 'error',
      });
      return;
    }

    setIsSubmitting(true);
    const abortController = new AbortController();

    try {
      await setFuaEstado(fuaRequest.id, selectedEstadoId, abortController);

      showSnackbar({
        title: t('success', 'Éxito'),
        subtitle: t('statusChangedSuccessfully', 'El estado del FUA se actualizó correctamente'),
        kind: 'success',
      });

      onStatusChanged?.();
      closeModal();
    } catch {
      showSnackbar({
        title: t('error', 'Error'),
        subtitle: t('errorChangingStatus', 'Ocurrió un error al cambiar el estado del FUA'),
        kind: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <RequirePrivilege privilege={fuaUpdatePrivilege}>
      <ModalHeader closeModal={closeModal} title={t('changeStatus', 'Cambiar Estado del FUA')} />
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

          {availableEstados.length > 0 ? (
            <Select
              id="fua-status-select"
              labelText={t('newStatus', 'Nuevo Estado')}
              value={selectedEstadoId?.toString() || ''}
              onChange={(e) => setSelectedEstadoId(Number(e.target.value))}
              disabled={isSubmitting}
            >
              <SelectItem value="" text={t('selectOption', 'Seleccione una opción')} />
              {availableEstados.map((estado) => (
                <SelectItem key={estado.id} value={estado.id.toString()} text={estado.nombre} />
              ))}
            </Select>
          ) : (
            <p className={styles.noTransitions}>
              {t('noAvailableTransitions', 'No hay transiciones de estado disponibles para este FUA')}
            </p>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeModal} disabled={isSubmitting}>
          {t('cancel', 'Cancelar')}
        </Button>
        <Button
          kind="primary"
          onClick={handleSubmit}
          disabled={isSubmitting || !selectedEstadoId || availableEstados.length === 0}
        >
          {isSubmitting ? <InlineLoading description={t('saving', 'Guardando...')} /> : t('save', 'Guardar')}
        </Button>
      </ModalFooter>
    </RequirePrivilege>
  );
};

export default ChangeFuaStatusModal;
