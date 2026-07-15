import {
  Button,
  InlineLoading,
  InlineNotification,
  ModalBody,
  ModalFooter,
  ModalHeader,
  RadioButton,
  RadioButtonGroup,
  Stack,
  Tag,
} from '@carbon/react';
import { getUserFacingErrorMessage, showSnackbar } from '@openmrs/esm-framework';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import { usePriorityConfig } from '../hooks/usePriorityConfig';
import { type EmergencyQueueEntry, transitionEmergencyQueueEntry, useQueues } from '../resources/emergency.resource';
import styles from './move-queue-entry.modal.scss';

interface MoveQueueEntryModalProps {
  queueEntry: EmergencyQueueEntry;
  closeModal: () => void;
}

const MoveQueueEntryModal: React.FC<MoveQueueEntryModalProps> = ({ queueEntry, closeModal }) => {
  const { t } = useTranslation();
  const { mutate } = useSWRConfig();
  const { getPriorityByUuid } = usePriorityConfig();
  const currentQueueLocationUuid = queueEntry.queue?.location?.uuid ?? queueEntry.locationWaitingFor?.uuid;
  const { queues, isLoading: isLoadingQueues } = useQueues(currentQueueLocationUuid);

  const patientName = queueEntry.patient.person?.display || queueEntry.patient.display;
  const currentQueueUuid = queueEntry.queue?.uuid;

  const [selectedQueue, setSelectedQueue] = useState(currentQueueUuid || '');
  const [selectedPriority, setSelectedPriority] = useState(queueEntry.priority?.uuid || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedQueueObj = useMemo(() => queues.find((q) => q.uuid === selectedQueue), [queues, selectedQueue]);
  const priorityOptions = useMemo(
    () =>
      (selectedQueueObj?.allowedPriorities ?? []).map((priority) => {
        const priorityConfig = getPriorityByUuid(priority.uuid);
        return {
          uuid: priority.uuid,
          label: priorityConfig?.label ?? priority.display,
          color: priorityConfig?.color,
        };
      }),
    [getPriorityByUuid, selectedQueueObj?.allowedPriorities],
  );
  const resolvedStatusUuid = useMemo(() => {
    const allowedStatuses = selectedQueueObj?.allowedStatuses ?? [];
    const currentStatusUuid = queueEntry.status?.uuid;

    if (!allowedStatuses.length) {
      return currentStatusUuid;
    }

    return allowedStatuses.some((status) => status.uuid === currentStatusUuid)
      ? currentStatusUuid
      : allowedStatuses[0].uuid;
  }, [queueEntry.status?.uuid, selectedQueueObj?.allowedStatuses]);

  const isUnchanged =
    selectedQueue === currentQueueUuid &&
    selectedPriority === queueEntry.priority?.uuid &&
    resolvedStatusUuid === queueEntry.status?.uuid;
  const canSubmit = Boolean(
    selectedQueue &&
      selectedPriority &&
      resolvedStatusUuid &&
      priorityOptions.length &&
      !isLoadingQueues &&
      !isSubmitting &&
      !isUnchanged,
  );

  useEffect(() => {
    if (!selectedQueueObj) {
      return;
    }

    if (!priorityOptions.length) {
      setSelectedPriority('');
      return;
    }

    if (!priorityOptions.some((priority) => priority.uuid === selectedPriority)) {
      const currentPriority = priorityOptions.find((priority) => priority.uuid === queueEntry.priority?.uuid);
      setSelectedPriority((currentPriority ?? priorityOptions[0]).uuid);
    }
  }, [priorityOptions, queueEntry.priority?.uuid, selectedPriority, selectedQueueObj]);

  const getPriorityTagProps = (color?: string) => {
    if (color === 'red') return { type: 'red' as const, className: styles.boldTag };
    if (color === 'orange') return { type: undefined, className: styles.orangeTag };
    if (color === 'yellow') return { type: undefined, className: styles.yellowTag };
    if (color === 'green') return { type: 'green' as const, className: '' };
    return { type: 'gray' as const, className: '' };
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await transitionEmergencyQueueEntry({
        queueEntryToTransition: queueEntry.uuid,
        newQueue: selectedQueue,
        newPriority: selectedPriority,
        newStatus: resolvedStatusUuid,
      });

      showSnackbar({
        isLowContrast: true,
        title: t('moveSuccess', 'Paciente movido'),
        kind: 'success',
        subtitle: t('moveSuccessMessage', 'El paciente ha sido movido a {{queue}}', {
          queue: selectedQueueObj?.display || '',
        }),
      });

      mutate((key) => typeof key === 'string' && key.includes('/queue-entry'));
      closeModal();
    } catch (error: unknown) {
      showSnackbar({
        title: t('moveError', 'Error al mover paciente'),
        kind: 'error',
        subtitle: getUserFacingErrorMessage(
          error,
          t(
            'moveErrorSafe',
            'No se pudo confirmar el movimiento del paciente. Actualice y verifique ambas colas antes de repetir la acción.',
          ),
          { logContext: 'Move emergency queue entry' },
        ),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <ModalHeader closeModal={closeModal} title={t('movePatient', 'Mover {{patient}}', { patient: patientName })} />
      <ModalBody>
        <div className={styles.modalBody}>
          <Stack gap={4}>
            {/* Queue picker */}
            <section>
              <div className={styles.sectionTitle}>{t('selectQueue', 'Seleccionar cola')}</div>
              {isLoadingQueues ? (
                <InlineLoading description={t('loading', 'Cargando...')} />
              ) : (
                <RadioButtonGroup
                  className={styles.radioButtonGroup}
                  name="queue"
                  valueSelected={selectedQueue}
                  orientation="vertical"
                  onChange={(uuid: string) => setSelectedQueue(uuid)}
                >
                  {queues.map((queue) => (
                    <RadioButton
                      key={queue.uuid}
                      labelText={
                        queue.uuid === currentQueueUuid
                          ? t('currentValueFormatted', '{{value}} (Actual)', { value: queue.display })
                          : queue.display
                      }
                      value={queue.uuid}
                    />
                  ))}
                </RadioButtonGroup>
              )}
            </section>

            {/* Priority picker */}
            <section>
              <div className={styles.sectionTitle}>{t('priority', 'Prioridad')}</div>
              {isLoadingQueues ? (
                <InlineLoading description={t('loading', 'Cargando...')} />
              ) : priorityOptions.length ? (
                <RadioButtonGroup
                  className={styles.radioButtonGroup}
                  name="priority"
                  valueSelected={selectedPriority}
                  orientation="horizontal"
                  onChange={(uuid: string) => setSelectedPriority(uuid)}
                >
                  {priorityOptions.map((priority) => {
                    const tagProps = getPriorityTagProps(priority.color);
                    return (
                      <RadioButton
                        key={priority.uuid}
                        labelText={
                          <Tag type={tagProps.type} size="sm" className={tagProps.className}>
                            {priority.label}
                          </Tag>
                        }
                        value={priority.uuid}
                      />
                    );
                  })}
                </RadioButtonGroup>
              ) : (
                <InlineNotification
                  kind="error"
                  lowContrast
                  hideCloseButton
                  title={t('noPrioritiesAvailable', 'No hay prioridades disponibles')}
                  subtitle={t(
                    'selectedQueueHasNoAllowedPriorities',
                    'La cola seleccionada no tiene prioridades permitidas configuradas.',
                  )}
                />
              )}
            </section>
          </Stack>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeModal} disabled={isSubmitting}>
          {t('cancel', 'Cancelar')}
        </Button>
        <Button kind="primary" onClick={handleSubmit} disabled={!canSubmit}>
          {isSubmitting ? t('moving', 'Moviendo...') : t('move', 'Mover')}
        </Button>
      </ModalFooter>
    </>
  );
};

export default MoveQueueEntryModal;
