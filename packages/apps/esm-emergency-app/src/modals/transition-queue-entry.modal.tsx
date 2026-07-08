import {
  Button,
  Checkbox,
  InlineLoading,
  InlineNotification,
  ModalBody,
  ModalFooter,
  ModalHeader,
  RadioButton,
  RadioButtonGroup,
  SelectItem,
  Stack,
  Tag,
  TextArea,
  TimePicker,
  TimePickerSelect,
} from '@carbon/react';
import { OpenmrsDatePicker, showSnackbar } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import { useEmergencyConfig, usePriorityConfig } from '../hooks/usePriorityConfig';
import { type EmergencyQueueEntry, transitionEmergencyQueueEntry, useQueues } from '../resources/emergency.resource';
import styles from './transition-queue-entry.modal.scss';

type AmPm = 'AM' | 'PM';

interface TransitionQueueEntryModalProps {
  queueEntry: EmergencyQueueEntry;
  closeModal: () => void;
}

const TransitionQueueEntryModal: React.FC<TransitionQueueEntryModalProps> = ({ queueEntry, closeModal }) => {
  const { t } = useTranslation();
  const { mutate } = useSWRConfig();
  const { queueStatuses } = useEmergencyConfig();
  const { getPriorityByUuid } = usePriorityConfig();
  const { queues, isLoading: isLoadingQueues } = useQueues();

  const patientName = queueEntry.patient.person?.display || queueEntry.patient.display;

  const defaultStatusOptions = useMemo(
    () => [
      { uuid: queueStatuses.waiting, label: t('statusWaiting', 'Esperando') },
      { uuid: queueStatuses.inService, label: t('statusInService', 'Atendiéndose') },
      { uuid: queueStatuses.finishedService, label: t('statusFinished', 'Servicio Finalizado') },
    ],
    [queueStatuses, t],
  );
  const currentQueueObj = useMemo(
    () => queues.find((queue) => queue.uuid === queueEntry.queue?.uuid),
    [queueEntry.queue?.uuid, queues],
  );
  const statusOptions = useMemo(
    () =>
      currentQueueObj?.allowedStatuses?.length
        ? currentQueueObj.allowedStatuses.map((status) => ({ uuid: status.uuid, label: status.display }))
        : defaultStatusOptions,
    [currentQueueObj?.allowedStatuses, defaultStatusOptions],
  );
  const priorityOptions = useMemo(
    () =>
      (currentQueueObj?.allowedPriorities ?? []).map((priority) => {
        const priorityConfig = getPriorityByUuid(priority.uuid);
        return {
          uuid: priority.uuid,
          label: priorityConfig?.label ?? priority.display,
          color: priorityConfig?.color,
        };
      }),
    [currentQueueObj?.allowedPriorities, getPriorityByUuid],
  );

  const now = new Date();
  const [selectedStatus, setSelectedStatus] = useState(queueEntry.status?.uuid || queueStatuses.waiting);
  const [selectedPriority, setSelectedPriority] = useState(queueEntry.priority?.uuid || '');
  const [comment, setComment] = useState('');
  const [useCurrentTime, setUseCurrentTime] = useState(true);
  const [transitionDate, setTransitionDate] = useState<Date>(now);
  const [transitionTime, setTransitionTime] = useState(dayjs(now).format('hh:mm'));
  const [transitionTimeFormat, setTransitionTimeFormat] = useState<AmPm>(now.getHours() < 12 ? 'AM' : 'PM');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isUnchanged = selectedStatus === queueEntry.status?.uuid && selectedPriority === queueEntry.priority?.uuid;
  const canSubmit = Boolean(
    selectedStatus && selectedPriority && priorityOptions.length && !isLoadingQueues && !isSubmitting && !isUnchanged,
  );

  useEffect(() => {
    if (!currentQueueObj) {
      return;
    }

    if (statusOptions.length && !statusOptions.some((status) => status.uuid === selectedStatus)) {
      const currentStatus = statusOptions.find((status) => status.uuid === queueEntry.status?.uuid);
      setSelectedStatus((currentStatus ?? statusOptions[0]).uuid);
    }

    if (!priorityOptions.length) {
      setSelectedPriority('');
      return;
    }

    if (!priorityOptions.some((priority) => priority.uuid === selectedPriority)) {
      const currentPriority = priorityOptions.find((priority) => priority.uuid === queueEntry.priority?.uuid);
      setSelectedPriority((currentPriority ?? priorityOptions[0]).uuid);
    }
  }, [
    currentQueueObj,
    priorityOptions,
    queueEntry.priority?.uuid,
    queueEntry.status?.uuid,
    selectedPriority,
    selectedStatus,
    statusOptions,
  ]);

  const getPriorityTagProps = (color?: string) => {
    if (color === 'red') return { type: 'red' as const, className: styles.boldTag };
    if (color === 'orange') return { type: undefined, className: styles.orangeTag };
    if (color === 'yellow') return { type: undefined, className: styles.yellowTag };
    if (color === 'green') return { type: 'green' as const, className: '' };
    return { type: 'gray' as const, className: '' };
  };

  const buildTransitionDate = (): string | undefined => {
    if (useCurrentTime) return undefined;

    const date = new Date(transitionDate);
    const [timeStr] = transitionTime.split(':');
    let hours = parseInt(timeStr, 10) || 0;
    const minutes = parseInt(transitionTime.split(':')[1], 10) || 0;

    if (transitionTimeFormat === 'PM' && hours !== 12) hours += 12;
    if (transitionTimeFormat === 'AM' && hours === 12) hours = 0;

    date.setHours(hours, minutes, 0, 0);
    return date.toISOString();
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await transitionEmergencyQueueEntry({
        queueEntryToTransition: queueEntry.uuid,
        newStatus: selectedStatus,
        newPriority: selectedPriority,
        ...(comment.trim() ? { newPriorityComment: comment.trim() } : {}),
        ...(() => {
          const td = buildTransitionDate();
          return td ? { transitionDate: td } : {};
        })(),
      });

      showSnackbar({
        isLowContrast: true,
        title: t('transitionSuccess', 'Transición exitosa'),
        kind: 'success',
        subtitle: t('transitionSuccessMessage', 'La entrada de cola ha sido transicionada correctamente'),
      });

      mutate((key) => typeof key === 'string' && key.includes('/queue-entry'));
      closeModal();
    } catch (error: unknown) {
      showSnackbar({
        title: t('transitionError', 'Error en la transición'),
        kind: 'error',
        subtitle:
          error instanceof Error
            ? error.message
            : t('transitionErrorGeneric', 'Ocurrió un error al transicionar la entrada'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <ModalHeader
        closeModal={closeModal}
        title={t('transitionPatient', 'Transición {{patient}}', { patient: patientName })}
      />
      <ModalBody>
        <div className={styles.modalBody}>
          <Stack gap={4}>
            {/* Status section */}
            <section>
              <div className={styles.sectionTitle}>{t('status', 'Estado')}</div>
              <RadioButtonGroup
                className={styles.radioButtonGroup}
                name="status"
                valueSelected={selectedStatus}
                orientation="horizontal"
                onChange={(uuid: string) => setSelectedStatus(uuid)}
              >
                {statusOptions.map(({ uuid, label }) => (
                  <RadioButton
                    key={uuid}
                    labelText={
                      uuid === queueEntry.status?.uuid
                        ? t('currentValueFormatted', '{{value}} (Actual)', { value: label })
                        : label
                    }
                    value={uuid}
                  />
                ))}
              </RadioButtonGroup>
            </section>

            {/* Priority section */}
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

            {/* Comment section */}
            <section>
              <div className={styles.sectionTitle}>{t('comment', 'Comentario')}</div>
              <TextArea
                labelText=""
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t('enterCommentHere', 'Ingrese un comentario aquí')}
              />
            </section>

            {/* Transition time section */}
            <section>
              <div className={styles.sectionTitle}>{t('timeOfTransition', 'Hora del traslado')}</div>
              <Checkbox
                labelText={t('now', 'Ahora')}
                id="transitionTimeNow"
                checked={useCurrentTime}
                onChange={(_, { checked }) => setUseCurrentTime(checked)}
              />
              {!useCurrentTime && (
                <div className={styles.dateTimeFields}>
                  <OpenmrsDatePicker
                    id="transitionDatePicker"
                    labelText={t('date', 'Fecha')}
                    value={transitionDate}
                    maxDate={new Date()}
                    onChange={(date: Date) => setTransitionDate(date)}
                  />
                  <TimePicker
                    id="transitionTimePicker"
                    labelText={t('time', 'Hora')}
                    value={transitionTime}
                    onChange={(e) => setTransitionTime(e.target.value)}
                    pattern="(1[012]|[1-9]):[0-5][0-9]"
                  >
                    <TimePickerSelect
                      id="transitionTimeFormat"
                      aria-label={t('time', 'Hora')}
                      value={transitionTimeFormat}
                      onChange={(e) => setTransitionTimeFormat(e.target.value as AmPm)}
                    >
                      <SelectItem value="AM" text="AM" />
                      <SelectItem value="PM" text="PM" />
                    </TimePickerSelect>
                  </TimePicker>
                </div>
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
          {isSubmitting ? t('transitioning', 'Transicionando...') : t('transition', 'Transición')}
        </Button>
      </ModalFooter>
    </>
  );
};

export default TransitionQueueEntryModal;
