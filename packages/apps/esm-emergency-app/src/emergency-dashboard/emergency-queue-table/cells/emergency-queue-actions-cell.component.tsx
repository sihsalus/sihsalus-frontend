/**
 * Context-aware action buttons for each row in the emergency queue table.
 *
 * Primary button changes based on patient state:
 * - Waiting in any queue -> "Atender" (serve)
 * - In service in Triage Queue -> "Triaje"
 * - In service in Attention Queue -> "Atencion de emergencia"
 *
 * Overflow menu includes secondary actions: move, transition, print, remove.
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
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { type Config } from '../../../config-schema';
import { emergencyEditPrivilege, MODALS, WORKSPACES } from '../../../constants';
import { useTriageVitalsSavedHandler } from '../../../emergency-workflow/hooks/useTriageVitalsSavedHandler';
import { loadTriageTransitionCheckpoint } from '../../../emergency-workflow/triage-transition-reconciliation-checkpoint';
import { useEmergencyConfig } from '../../../hooks/usePriorityConfig';
import styles from './emergency-queue-actions-cell.scss';
import { type EmergencyQueueTableCellProps } from './emergency-queue-name-cell.component';

export const EmergencyQueueActionsCell: React.FC<EmergencyQueueTableCellProps> = ({ queueEntry }) => {
  const { t } = useTranslation();
  const layout = useLayoutType();
  const config = useConfig<Config>();
  const session = useSession();
  const { queueStatuses, emergencyTriageQueueUuid } = useEmergencyConfig();
  const canEdit = userHasAccess(emergencyEditPrivilege, session?.user);
  const handleTriageVitalsSaved = useTriageVitalsSavedHandler(queueEntry);

  const isWaiting = queueEntry?.status?.uuid === queueStatuses.waiting;
  const isInService = queueEntry?.status?.uuid === queueStatuses.inService;
  const isInTriageQueue = queueEntry?.queue?.uuid === emergencyTriageQueueUuid;

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
    if (loadTriageTransitionCheckpoint(queueEntry.uuid)) {
      showSnackbar({
        title: t('triageAlreadySaved', 'Signos vitales ya guardados'),
        kind: 'warning',
        subtitle: t(
          'triageTransitionUnverifiedSafe',
          'Los signos vitales fueron guardados, pero no se pudo confirmar el envío a atención. No vuelva a guardar los signos ni repita el triaje; revise la cola.',
        ),
      });
      return;
    }

    launchWorkspace2(
      WORKSPACES.TRIAGE_VITALS_FORM,
      {
        encounterTypeUuid: triageEncounterTypeUuid,
        locationUuid: config.emergencyLocationUuid,
        onVitalsSaved: handleTriageVitalsSaved,
        profile: 'emergency-triage',
      },
      null,
      {
        patientUuid: queueEntry.patient.uuid,
      },
    );
  }, [
    config.emergencyLocationUuid,
    handleTriageVitalsSaved,
    queueEntry.patient.uuid,
    queueEntry.uuid,
    t,
    triageEncounterTypeUuid,
  ]);

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

  const handleRemoveFromQueue = useCallback(() => {
    const dispose = showModal(MODALS.REMOVE_QUEUE_ENTRY, {
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
        subtitle: t('printStickerNoPatient', 'No se encontro el UUID del paciente'),
      });
      return;
    }
    const url = `${globalThis.openmrsBase}${restBaseUrl}/patientdocuments/patientIdSticker?patientUuid=${patientUuid}&inline=true`;
    globalThis.open(url, '_blank');
  }, [queueEntry.patient?.uuid, t]);

  return (
    <div className={styles.actionsCell}>
      {/* Primary action - context-aware based on patient status */}
      {canEdit && isWaiting && (
        <Button kind="ghost" size={isDesktop(layout) ? 'sm' : 'lg'} onClick={handleServePatient}>
          {t('serve', 'Atender')}
        </Button>
      )}
      {canEdit && isInService && isInTriageQueue && (
        <Button kind="ghost" size={isDesktop(layout) ? 'sm' : 'lg'} onClick={handleOpenTriage}>
          {t('triage', 'Triaje')}
        </Button>
      )}
      {canEdit && isInService && !isInTriageQueue && (
        <Button kind="ghost" size={isDesktop(layout) ? 'sm' : 'lg'} onClick={handleOpenAttention}>
          {t('emergencyAttention', 'Atencion de emergencia')}
        </Button>
      )}
      {/* Secondary actions */}
      <OverflowMenu
        aria-label={t('actionsMenu', 'Actions menu')}
        size={isDesktop(layout) ? 'sm' : 'lg'}
        align="left"
        flipped
      >
        {canEdit && !isInTriageQueue && (
          <OverflowMenuItem
            itemText={t('emergencyAttention', 'Atencion de emergencia')}
            onClick={handleOpenAttention}
          />
        )}
        {canEdit && isTriagePending && (
          <OverflowMenuItem itemText={t('completeTriage', 'Completar triaje')} onClick={handleOpenTriage} />
        )}
        <OverflowMenuItem itemText={t('viewChart', 'Ver ficha')} onClick={handleGoToChart} />
        {canEdit && <OverflowMenuItem itemText={t('moveToQueue', 'Mover a cola')} onClick={handleMoveToQueue} />}
        {canEdit && <OverflowMenuItem itemText={t('transition', 'Transicion')} onClick={handleTransition} />}
        <OverflowMenuItem itemText={t('printSticker', 'Imprimir sticker')} onClick={handlePrintSticker} />
        {canEdit && (
          <OverflowMenuItem
            itemText={t('removeFromQueue', 'Eliminar de cola')}
            onClick={handleRemoveFromQueue}
            isDelete
            hasDivider
          />
        )}
      </OverflowMenu>
    </div>
  );
};
