import { Button, OverflowMenu, OverflowMenuItem } from '@carbon/react';
import {
  fetchCurrentPatient,
  getUserFacingErrorMessage,
  isDesktop,
  launchWorkspace2,
  navigate,
  showModal,
  showSnackbar,
  userHasAccess,
  useLayoutType,
  useSession,
} from '@openmrs/esm-framework';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { serviceQueuesPatientVitalsWorkspace } from '../../constants';
import { useMutateQueueEntries } from '../../hooks/useQueueEntries';
import { canEditServiceQueues, canTriageQueuePatients } from '../../permissions';
import { getAppointmentTriageConfig, transitionTriagedPatient } from '../../triage-workflow/triage-workflow.resource';
import { type QueueTableCellComponentProps, type QueueTableColumnFunction } from '../../types';

import styles from './queue-table-action-cell.scss';

export function QueueTableActionCell({ queueEntry }: QueueTableCellComponentProps) {
  const { t } = useTranslation();
  const layout = useLayoutType();
  const session = useSession();
  const canEdit = canEditServiceQueues(session?.user);
  const canTriage = canTriageQueuePatients(session?.user);
  const isTriageQueue = Boolean(queueEntry.workflow?.isTriageQueue);
  const patientPerson = queueEntry.patient?.person as { dead?: boolean; deathDate?: string | null } | undefined;
  const isDeceasedPatient = Boolean(patientPerson?.dead || patientPerson?.deathDate);
  const requiresCashier = isTriageQueue && queueEntry.workflow?.sisState !== 'active';
  const canOpenBilling = userHasAccess('app:home.facturacion', session?.user);
  const canPerformTriage =
    isTriageQueue && !isDeceasedPatient && !requiresCashier && canTriage && Boolean(queueEntry.visit?.uuid);
  const [isSubmittingTriage, setIsSubmittingTriage] = useState(false);
  const { mutateQueueEntries } = useMutateQueueEntries();

  const transitionAfterTriage = async () => {
    try {
      await transitionTriagedPatient(queueEntry);
      await mutateQueueEntries();
      showSnackbar({
        isLowContrast: true,
        kind: 'success',
        title: t('triageCompleted', 'Triaje realizado'),
        subtitle: t('patientSentToClinicalQueue', 'El paciente fue enviado a la cola correspondiente a su cita.'),
      });
    } catch (error) {
      showSnackbar({
        isLowContrast: false,
        kind: 'error',
        title: t('triageRoutingFailed', 'El triaje se guardó, pero no se pudo derivar al paciente'),
        subtitle: getUserFacingErrorMessage(
          error,
          t('triageRoutingFailedDescription', 'Use “Enviar a atención” para reintentar o revise la ruta de la cita.'),
          { logContext: `Route triaged queue entry ${queueEntry.uuid}` },
        ),
      });
    }
  };

  const handleTriage = async () => {
    setIsSubmittingTriage(true);
    try {
      const latestPatient = await fetchCurrentPatient(queueEntry.patient.uuid, undefined, false);
      if (!latestPatient) {
        throw new Error('The patient could not be loaded.');
      }
      if (latestPatient.deceasedBoolean || latestPatient.deceasedDateTime) {
        showSnackbar({
          isLowContrast: false,
          kind: 'error',
          title: t('triageUnavailable', 'Triaje no disponible'),
          subtitle: t(
            'deceasedPatientTriageBlocked',
            'No se puede realizar ni derivar el triaje de un paciente fallecido.',
          ),
        });
        return;
      }
      if (queueEntry.workflow?.triageState === 'completed') {
        await transitionAfterTriage();
        return;
      }
      const config = await getAppointmentTriageConfig();
      await launchWorkspace2(
        serviceQueuesPatientVitalsWorkspace,
        {
          encounterTypeUuid: config.triageRouting.encounterTypeUuid,
          locationUuid: config.triageRouting.queueLocationUuid,
          onVitalsSaved: transitionAfterTriage,
          profile: 'default',
        },
        null,
        { patientUuid: queueEntry.patient.uuid },
      );
    } catch (error) {
      showSnackbar({
        isLowContrast: false,
        kind: 'error',
        title: t('couldNotStartTriage', 'No se pudo iniciar el triaje'),
        subtitle: getUserFacingErrorMessage(
          error,
          t('couldNotStartTriageDescription', 'Revise la consulta y la configuración de colas.'),
          { logContext: `Start triage for queue entry ${queueEntry.uuid}` },
        ),
      });
    } finally {
      setIsSubmittingTriage(false);
    }
  };

  const handleSendToCashier = () => {
    showSnackbar({
      isLowContrast: true,
      kind: 'warning',
      title: t('triageBlockedByFinancing', 'Triaje bloqueado por financiamiento'),
      subtitle: t(
        'sendPatientToCashierDescription',
        'El paciente no tiene SIS vigente. Debe regularizar el pago o la cobertura en Caja antes de continuar con el triaje.',
      ),
    });
    if (canOpenBilling) {
      navigate({ to: `${globalThis.getOpenmrsSpaBase()}home/billing` });
    }
  };

  if (!canEdit && !canPerformTriage) {
    return null;
  }

  return (
    <div className={styles.actionsCell}>
      {isTriageQueue && !isDeceasedPatient && requiresCashier ? (
        <Button kind="danger--tertiary" onClick={handleSendToCashier} size={isDesktop(layout) ? 'sm' : 'lg'}>
          {canOpenBilling ? t('sendToCashier', 'Derivar a Caja') : t('requiresCashier', 'Requiere Caja')}
        </Button>
      ) : isTriageQueue && canPerformTriage ? (
        <Button
          disabled={isSubmittingTriage}
          kind="primary"
          onClick={handleTriage}
          size={isDesktop(layout) ? 'sm' : 'lg'}
        >
          {queueEntry.workflow.triageState === 'completed'
            ? t('sendToCare', 'Enviar a atención')
            : t('performTriage', 'Realizar triaje')}
        </Button>
      ) : canEdit && !isDeceasedPatient ? (
        <Button
          kind="ghost"
          aria-label={t('transition', 'Transition')}
          onClick={() => {
            const dispose = showModal('transition-queue-entry-modal', {
              closeModal: () => dispose(),
              queueEntry,
            });
          }}
          size={isDesktop(layout) ? 'sm' : 'lg'}
        >
          {t('transition', 'Transition')}
        </Button>
      ) : null}
      {canEdit && (
        <OverflowMenu
          aria-label={t('actions', 'Actions')}
          iconDescription={t('actions', 'Actions')}
          size={isDesktop(layout) ? 'sm' : 'lg'}
          align="left"
          flipped
        >
          <OverflowMenuItem
            className={styles.menuItem}
            aria-label={t('edit', 'Edit')}
            hasDivider
            onClick={() => {
              const dispose = showModal('edit-queue-entry-modal', {
                closeModal: () => dispose(),
                queueEntry,
              });
            }}
            itemText={t('edit', 'Edit')}
          />
          <OverflowMenuItem
            className={styles.menuItem}
            aria-label={t('removePatient', 'Remove patient')}
            hasDivider
            onClick={() => {
              const dispose = showModal('end-queue-entry-modal', {
                closeModal: () => dispose(),
                queueEntry,
                size: 'sm',
              });
            }}
            itemText={t('removePatient', 'Remove patient')}
          />
          {queueEntry.previousQueueEntry == null ? (
            <OverflowMenuItem
              className={styles.menuItem}
              aria-label={t('delete', 'Delete')}
              hasDivider
              isDelete
              onClick={() => {
                const dispose = showModal('void-queue-entry-modal', {
                  closeModal: () => dispose(),
                  queueEntry,
                  size: 'sm',
                });
              }}
              itemText={t('delete', 'Delete')}
            />
          ) : (
            <OverflowMenuItem
              className={styles.menuItem}
              aria-label={t('undoTransition', 'Undo transition')}
              hasDivider
              isDelete
              onClick={() => {
                const dispose = showModal('undo-transition-queue-entry-modal', {
                  closeModal: () => dispose(),
                  queueEntry,
                  size: 'sm',
                });
              }}
              itemText={t('undoTransition', 'Undo transition')}
            />
          )}
        </OverflowMenu>
      )}
    </div>
  );
}

export const queueTableActionColumn: QueueTableColumnFunction = (key, header) => ({
  key,
  header,
  CellComponent: QueueTableActionCell,
  getFilterableValue: null,
});
