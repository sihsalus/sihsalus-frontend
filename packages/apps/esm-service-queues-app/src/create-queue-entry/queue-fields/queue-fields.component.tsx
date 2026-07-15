import {
  InlineNotification,
  RadioButton,
  RadioButtonGroup,
  RadioButtonSkeleton,
  Select,
  SelectItem,
  SelectSkeleton,
} from '@carbon/react';
import {
  getUserFacingErrorMessage as frameworkGetUserFacingErrorMessage,
  ResponsiveWrapper,
  showSnackbar,
  useConfig,
  useSession,
  type Visit,
} from '@openmrs/esm-framework';
import { getCompatibleUserFacingErrorMessage } from '@openmrs/esm-utils';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type ConfigObject } from '../../config-schema';
import { useMutateQueueEntries } from '../../hooks/useQueueEntries';
import { useQueues } from '../../hooks/useQueues';
import { AddPatientToQueueContext } from '../create-queue-entry.workspace';
import { useQueueLocations } from '../hooks/useQueueLocations';

import {
  ACTIVE_QUEUE_ENTRY_CONFLICT,
  ACTIVE_VISIT_QUEUE_CONFLICT,
  MULTIPLE_ACTIVE_VISIT_QUEUE_ENTRIES,
  postQueueEntry,
  QUEUE_ENTRY_CREATION_UNVERIFIED,
  QUEUE_TICKET_GENERATION_FAILED,
} from './queue-fields.resource';
import styles from './queue-fields.scss';

// Same visual convention as patient registration and the appointments form.
function RequiredFieldLabel({ label }: { label: string }) {
  return <span className={styles.requiredLabel}>{label}</span>;
}

export interface QueueFieldsProps {
  currentServiceQueueUuid?: string;
  currentQueueLocationUuid?: string;
  patientGender?: string;
  requestedServiceName?: string;
  onQueueEntryAdded?: () => void | Promise<void>;
  setCallbacks(callbacks: QueueFieldsCallbacks): void;
}

export interface QueueFieldsCallbacks {
  onBeforeVisitSave: () => boolean;
  onVisitCreatedOrUpdated: (visit: Visit) => Promise<unknown>;
}

/**
 * This component contains form fields for starting a patient's queue entry.
 */
const QueueFields: React.FC<QueueFieldsProps> = ({
  currentServiceQueueUuid,
  currentQueueLocationUuid,
  patientGender,
  requestedServiceName,
  onQueueEntryAdded,
  setCallbacks,
}) => {
  const { t } = useTranslation();
  const { queueLocations, isLoading: isLoadingQueueLocations } = useQueueLocations();
  const { sessionLocation } = useSession();
  const sessionLocationUuid = sessionLocation?.uuid;
  const {
    visitQueueNumberAttributeUuid,
    concepts: { defaultStatusConceptUuid, defaultPriorityConceptUuid, emergencyPriorityConceptUuid },
  } = useConfig<ConfigObject>();
  const [selectedQueueLocation, setSelectedQueueLocation] = useState('');
  const availableQueueLocations = useMemo(() => {
    const normalizedGender = patientGender?.trim().toLowerCase();
    const isMalePatient = normalizedGender === 'm' || normalizedGender === 'male' || normalizedGender === 'masculino';

    if (!isMalePatient) {
      return queueLocations;
    }

    return queueLocations.filter(
      (location) => location.id === currentQueueLocationUuid || !/obst[eé]tric/i.test(location.name ?? ''),
    );
  }, [currentQueueLocationUuid, patientGender, queueLocations]);
  const { queues, isLoading: isLoadingQueues } = useQueues(selectedQueueLocation);
  const [selectedService, setSelectedService] = useState('');
  const { currentServiceQueueUuid: contextServiceQueueUuid } = useContext(AddPatientToQueueContext);
  const selectedServiceQueueUuid = currentServiceQueueUuid ?? contextServiceQueueUuid;
  const selectedQueue = useMemo(() => queues.find((q) => q.uuid === selectedService), [queues, selectedService]);
  const priorities = selectedQueue?.allowedPriorities ?? [];
  const statuses = selectedQueue?.allowedStatuses ?? [];
  const [priority, setPriority] = useState('');
  const [status, setStatus] = useState('');
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const { mutateQueueEntries } = useMutateQueueEntries();
  const memoMutateQueueEntries = useCallback(mutateQueueEntries, [mutateQueueEntries]);

  const sortWeight = priority === emergencyPriorityConceptUuid ? 1 : 0;
  const isValid = Boolean(
    selectedQueueLocation &&
      selectedService &&
      priority &&
      status &&
      visitQueueNumberAttributeUuid &&
      !isLoadingQueueLocations &&
      !isLoadingQueues,
  );

  const onBeforeVisitSave = useCallback(() => {
    setShowValidationErrors(!isValid);
    return isValid;
  }, [isValid]);

  const onSubmit = useCallback(
    (visit: Visit) => {
      if (!onBeforeVisitSave()) {
        return Promise.reject(new Error('Queue fields are incomplete.'));
      }

      if (selectedQueueLocation && selectedService && priority && status) {
        return postQueueEntry(
          visit.uuid,
          selectedService,
          visit.patient.uuid,
          priority,
          status,
          sortWeight,
          selectedQueueLocation,
          visitQueueNumberAttributeUuid,
          visit.startDatetime,
        )
          .catch((error) => {
            showSnackbar({
              title: t('queueEntryError', 'No se pudo agregar el paciente a la cola'),
              kind: 'error',
              isLowContrast: false,
              subtitle: getCompatibleUserFacingErrorMessage(
                error,
                t('queueEntryActionErrorMessage', 'No se pudo completar la acción de cola. Intente nuevamente.'),
                {
                  codeMessages: {
                    [ACTIVE_QUEUE_ENTRY_CONFLICT]: t(
                      'activeQueueEntryForAnotherVisit',
                      'El paciente ya tiene una entrada activa en esta cola asociada a otra consulta.',
                    ),
                    [ACTIVE_VISIT_QUEUE_CONFLICT]: t(
                      'activeVisitInAnotherQueue',
                      'La consulta ya tiene una entrada activa en otra cola. Transicione o finalice esa entrada antes de seleccionar otra cola.',
                    ),
                    [MULTIPLE_ACTIVE_VISIT_QUEUE_ENTRIES]: t(
                      'multipleActiveQueueEntriesForVisit',
                      'La consulta tiene más de una entrada activa en cola. Regularice las entradas antes de continuar.',
                    ),
                    [QUEUE_ENTRY_CREATION_UNVERIFIED]: t(
                      'queueEntryCreationUnverified',
                      'No se pudo verificar la entrada activa en la cola seleccionada. Actualice la cola antes de reintentar.',
                    ),
                    [QUEUE_TICKET_GENERATION_FAILED]: t(
                      'queueTicketGenerationFailed',
                      'No se pudo generar el número de turno. Verifique la configuración antes de reintentar.',
                    ),
                  },
                  logContext: 'Add patient to queue',
                },
                frameworkGetUserFacingErrorMessage,
              ),
            });
            throw error;
          })
          .then(() => {
            showSnackbar({
              kind: 'success',
              isLowContrast: true,
              title: t('addedPatientToQueue', 'Added patient to queue'),
              subtitle: t('queueEntryAddedSuccessfully', 'Queue entry added successfully'),
            });
            memoMutateQueueEntries();
            return onQueueEntryAdded?.();
          });
      } else {
        return Promise.resolve();
      }
    },
    [
      selectedQueueLocation,
      selectedService,
      priority,
      status,
      sortWeight,
      visitQueueNumberAttributeUuid,
      memoMutateQueueEntries,
      onQueueEntryAdded,
      onBeforeVisitSave,
      t,
    ],
  );

  useEffect(() => {
    setCallbacks({ onBeforeVisitSave, onVisitCreatedOrUpdated: onSubmit });
  }, [onBeforeVisitSave, onSubmit, setCallbacks]);

  useEffect(() => {
    if (isValid) {
      setShowValidationErrors(false);
    }
  }, [isValid]);

  useEffect(() => {
    if (selectedServiceQueueUuid) {
      setSelectedService(selectedServiceQueueUuid);
    }
  }, [selectedServiceQueueUuid]);

  useEffect(() => {
    if (currentQueueLocationUuid) {
      setSelectedQueueLocation(currentQueueLocationUuid);
      return;
    }

    if (selectedQueueLocation) {
      return;
    }

    const defaultLocation =
      availableQueueLocations.find((location) => location.id === sessionLocationUuid) ?? availableQueueLocations[0];
    setSelectedQueueLocation(defaultLocation?.id ?? '');
  }, [availableQueueLocations, currentQueueLocationUuid, selectedQueueLocation, sessionLocationUuid]);

  useEffect(() => {
    const nextPriority = priorities.some((allowedPriority) => allowedPriority.uuid === defaultPriorityConceptUuid)
      ? defaultPriorityConceptUuid
      : (priorities[0]?.uuid ?? '');

    setPriority((currentPriority) =>
      priorities.some((allowedPriority) => allowedPriority.uuid === currentPriority) ? currentPriority : nextPriority,
    );
  }, [defaultPriorityConceptUuid, priorities]);

  useEffect(() => {
    const nextStatus = statuses.some((allowedStatus) => allowedStatus.uuid === defaultStatusConceptUuid)
      ? defaultStatusConceptUuid
      : (statuses[0]?.uuid ?? '');

    setStatus((currentStatus) =>
      statuses.some((allowedStatus) => allowedStatus.uuid === currentStatus) ? currentStatus : nextStatus,
    );
  }, [defaultStatusConceptUuid, statuses]);

  return (
    <div>
      {!visitQueueNumberAttributeUuid && (
        <InlineNotification
          className={styles.inlineNotification}
          hideCloseButton
          kind="error"
          lowContrast
          title={t('queueTicketConfigurationMissing', 'No se configuró el atributo para generar el número de turno.')}
        />
      )}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>{t('queueLocation', 'Queue location')}</div>
        <ResponsiveWrapper>
          {isLoadingQueueLocations ? (
            <SelectSkeleton />
          ) : (
            <Select
              disabled={Boolean(currentQueueLocationUuid)}
              labelText={<RequiredFieldLabel label={t('selectQueueLocation', 'Select a queue location')} />}
              id="queueLocation"
              name="queueLocation"
              invalid={showValidationErrors && !selectedQueueLocation}
              invalidText={t('required', 'Required')}
              value={selectedQueueLocation}
              onChange={(event) => setSelectedQueueLocation(event.target.value)}
            >
              {!selectedQueueLocation ? (
                <SelectItem text={t('selectQueueLocation', 'Select a queue location')} value="" />
              ) : null}
              {availableQueueLocations?.length > 0 &&
                availableQueueLocations.map((location) => (
                  <SelectItem key={location.id} text={location.name} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
            </Select>
          )}
        </ResponsiveWrapper>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>{t('service', 'Service')}</div>
        {requestedServiceName ? (
          <InlineNotification
            className={styles.inlineNotification}
            hideCloseButton
            kind="info"
            lowContrast
            title={t('appointmentService', 'Servicio de la cita: {{serviceName}}', {
              serviceName: requestedServiceName,
            })}
          />
        ) : null}
        {isLoadingQueues ? (
          <SelectSkeleton />
        ) : !queues?.length ? (
          <InlineNotification
            className={styles.inlineNotification}
            kind={'error'}
            lowContrast
            subtitle={t('configureServices', 'Please configure services to continue.')}
            title={t('noServicesConfigured', 'No services configured')}
          />
        ) : (
          <Select
            disabled={Boolean(currentServiceQueueUuid)}
            labelText={<RequiredFieldLabel label={t('selectService', 'Select a service')} />}
            id="service"
            name="service"
            invalid={showValidationErrors && !selectedService}
            invalidText={t('required', 'Required')}
            value={selectedService}
            onChange={(event) => setSelectedService(event.target.value)}
          >
            {!selectedService ? <SelectItem text={t('selectQueueService', 'Select a queue service')} value="" /> : null}
            {queues?.length > 0 &&
              queues.map((service) => (
                <SelectItem key={service.uuid} text={service.name} value={service.uuid}>
                  {service.name}
                </SelectItem>
              ))}
          </Select>
        )}
      </section>

      {/* Status section of the form would go here; historical version of this code can be found at
          https://github.com/openmrs/openmrs-esm-patient-management/blame/6c31e5ff2579fc89c2fd0d12c13510a1f2e913e0/packages/esm-service-queues-app/src/patient-search/visit-form-queue-fields/visit-form-queue-fields.component.tsx#L115 */}

      {selectedService ? (
        <section className={styles.section}>
          <div className={styles.sectionTitle}>
            <RequiredFieldLabel label={t('priority', 'Priority')} />
          </div>
          {isLoadingQueues ? (
            <RadioButtonGroup id="priority-skeleton" name="priority-skeleton">
              <RadioButtonSkeleton />
              <RadioButtonSkeleton />
              <RadioButtonSkeleton />
            </RadioButtonGroup>
          ) : !priorities?.length ? (
            <InlineNotification
              className={styles.inlineNotification}
              kind={'error'}
              lowContrast
              title={t('noPrioritiesForServiceTitle', 'No priorities available')}
            >
              {t(
                'noPrioritiesForService',
                'The selected service does not have any allowed priorities. This is an error in configuration. Please contact your system administrator.',
              )}
            </InlineNotification>
          ) : priorities.length ? (
            <RadioButtonGroup
              className={styles.radioButtonWrapper}
              name="priority"
              id="priority"
              invalid={showValidationErrors && !priority}
              invalidText={t('required', 'Required')}
              valueSelected={priority}
              onChange={(uuid) => setPriority(String(uuid))}
            >
              {priorities.map(({ uuid, display }) => (
                <RadioButton key={uuid} labelText={display} value={uuid} />
              ))}
            </RadioButtonGroup>
          ) : null}
        </section>
      ) : null}

      {selectedService && !isLoadingQueues && !statuses.length ? (
        <section className={styles.section}>
          <div className={styles.sectionTitle}>{t('status', 'Status')}</div>
          <InlineNotification
            className={styles.inlineNotification}
            kind={'error'}
            lowContrast
            title={t('noStatusesForServiceTitle', 'No statuses available')}
          >
            {t(
              'noStatusesForService',
              'The selected service does not have any allowed statuses. This is an error in configuration. Please contact your system administrator.',
            )}
          </InlineNotification>
        </section>
      ) : null}
    </div>
  );
};

export default QueueFields;
