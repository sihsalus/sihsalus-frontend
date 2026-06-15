/**
 * Context-aware action buttons for each row in the emergency queue table.
 *
 * Primary button changes based on patient state:
 * - Waiting in any queue → "Atender" (serve)
 * - In service in Triage Queue → "Triaje"
 * - In service in Attention Queue → "Atención de emergencia"
 *
 * Overflow menu includes secondary actions: move, transition, edit, print, remove.
 * Shows "Completar triaje" when patient is in Attention Queue without a triage encounter.
 */

import { Button, OverflowMenu, OverflowMenuItem } from '@carbon/react';
import {
  isDesktop,
  launchWorkspace,
  launchWorkspace2,
  navigate,
  restBaseUrl,
  showModal,
  showSnackbar,
  useConfig,
  useLayoutType,
} from '@openmrs/esm-framework';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { type Config } from '../../../config-schema';
import { MODALS, WORKSPACES } from '../../../constants';
import { useEmergencyConfig } from '../../../hooks/usePriorityConfig';
import styles from './emergency-queue-actions-cell.scss';
import { type EmergencyQueueTableCellProps } from './emergency-queue-name-cell.component';

export const EmergencyQueueActionsCell: React.FC<EmergencyQueueTableCellProps> = ({ queueEntry }) => {
  const { t } = useTranslation();
  const layout = useLayoutType();
  const config = useConfig<Config>();
  const { queueStatuses, emergencyTriageQueueUuid } = useEmergencyConfig();

  const isWaiting = queueEntry?.status?.uuid === queueStatuses.waiting;
  const isInService = queueEntry?.status?.uuid === queueStatuses.inService;
  const isInTriageQueue = queueEntry?.queue?.uuid === emergencyTriageQueueUuid;
  const hasPreviousEntry = queueEntry?.previousQueueEntry != null;

  // Check if patient has a triage encounter in their visit
  const triageEncounterTypeUuid = config.triageEncounter.encounterTypeUuid;
  const hasTriageEncounter =
    queueEntry?.visit?.encounters?.some((enc) => enc.encounterType?.uuid === triageEncounterTypeUuid && !enc.voided) ??
    false;
  const isTriagePending = !isInTriageQueue && !hasTriageEncounter;

  const handleServePatient = useCallback(() => {
    const dispose = showModal(MODALS.SERVE_PATIENT, {
      closeModal: () => dispose(),
      queueEntry,
    });
  }, [queueEntry]);

  const handleOpenTriage = useCallback(() => {
    launchWorkspace2(WORKSPACES.TRIAGE_VITALS_FORM, { encounterTypeUuid: triageEncounterTypeUuid }, null, {
      patientUuid: queueEntry.patient.uuid,
    });
  }, [queueEntry.patient.uuid, triageEncounterTypeUuid]);

  const handleOpenAttention = useCallback(() => {
    launchWorkspace(WORKSPACES.ATTENTION_FORM, {
      queueEntry,
    });
  }, [queueEntry]);

  const handleGoToChart = useCallback(() => {
    navigate({
      to: `${globalThis.spaBase}/patient/${queueEntry.patient.uuid}/chart/Patient%20Summary`,
    });
  }, [queueEntry.patient.uuid]);

  const handleMoveToQueue = useCallback(() => {
    const dispose = showModal(MODALS.MOVE_QUEUE_ENTRY, {
      closeModal: () => dispose(),
      queueEntry,
    });
  }, [queueEntry]);

  const handleTransition = useCallback(() => {
    const dispose = showModal(MODALS.TRANSITION_QUEUE_ENTRY, {
      closeModal: () => dispose(),
      queueEntry,
    });
  }, [queueEntry]);

  const handleEditEntry = useCallback(() => {
    const dispose = showModal(MODALS.EDIT_QUEUE_ENTRY, {
      closeModal: () => dispose(),
      queueEntry,
    });
  }, [queueEntry]);

  const handleRemoveFromQueue = useCallback(() => {
    const dispose = showModal(MODALS.REMOVE_QUEUE_ENTRY, {
      closeModal: () => dispose(),
      queueEntry,
    });
  }, [queueEntry]);

  const handleUndoTransition = useCallback(() => {
    const dispose = showModal(MODALS.UNDO_TRANSITION, {
      closeModal: () => dispose(),
      queueEntry,
    });
  }, [queueEntry]);

  const handlePrintSticker = useCallback(() => {
    const patientUuid = queueEntry.patient?.uuid;
    if (!patientUuid) {
      showSnackbar({
        title: t('printStickerError', 'Error al imprimir sticker'),
        kind: 'error',
        subtitle: t('printStickerNoPatient', 'No se encontró el UUID del paciente'),
      });
      return;
    }
    const url = `${globalThis.openmrsBase}${restBaseUrl}/patientdocuments/patientIdSticker?patientUuid=${patientUuid}&inline=true`;
    globalThis.open(url, '_blank');
  }, [queueEntry.patient?.uuid, t]);

  return (
    <div className={styles.actionsCell}>
      {/* Primary action — context-aware based on patient status */}
      {isWaiting && (
        <Button kind="ghost" size={isDesktop(layout) ? 'sm' : 'lg'} onClick={handleServePatient}>
          {t('serve', 'Atender')}
        </Button>
      )}
      {isInService && isInTriageQueue && (
        <Button kind="ghost" size={isDesktop(layout) ? 'sm' : 'lg'} onClick={handleOpenTriage}>
          {t('triage', 'Triaje')}
        </Button>
      )}
      {isInService && !isInTriageQueue && (
        <Button kind="ghost" size={isDesktop(layout) ? 'sm' : 'lg'} onClick={handleOpenAttention}>
          {t('emergencyAttention', 'Atención de emergencia')}
        </Button>
      )}
      {/* Secondary actions */}
      <OverflowMenu
        aria-label={t('actionsMenu', 'Actions menu')}
        size={isDesktop(layout) ? 'sm' : 'lg'}
        align="left"
        flipped
      >
        {!isInTriageQueue && (
          <OverflowMenuItem
            itemText={t('emergencyAttention', 'Atención de emergencia')}
            onClick={handleOpenAttention}
          />
        )}
        {isTriagePending && (
          <OverflowMenuItem itemText={t('completeTriage', 'Completar triaje')} onClick={handleOpenTriage} />
        )}
        <OverflowMenuItem itemText={t('viewChart', 'Ver ficha')} onClick={handleGoToChart} />
        <OverflowMenuItem itemText={t('moveToQueue', 'Mover a cola')} onClick={handleMoveToQueue} />
        <OverflowMenuItem itemText={t('transition', 'Transición')} onClick={handleTransition} />
        <OverflowMenuItem itemText={t('editEntry', 'Editar entrada')} onClick={handleEditEntry} />
        <OverflowMenuItem itemText={t('printSticker', 'Imprimir sticker')} onClick={handlePrintSticker} />
        <OverflowMenuItem
          itemText={t('removeFromQueue', 'Eliminar de cola')}
          onClick={handleRemoveFromQueue}
          isDelete
          hasDivider
        />
        {hasPreviousEntry && (
          <OverflowMenuItem
            itemText={t('undoTransition', 'Deshacer transición')}
            onClick={handleUndoTransition}
            isDelete
          />
        )}
      </OverflowMenu>
    </div>
  );
};
