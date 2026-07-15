/**
 * Emergency Attention Form Workspace.
 *
 * Opened from the Attention Queue when a doctor clicks "Atender" or "Atención de emergencia".
 * Captures diagnosis, treatment plan, and auxiliary exams as text observations
 * in an "Atención en Emergencia" encounter linked to the patient's emergency visit.
 */

import { Button, Form, InlineLoading, InlineNotification, Stack, TextArea } from '@carbon/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { type DefaultWorkspaceProps, getUserFacingErrorMessage, showSnackbar, useConfig } from '@openmrs/esm-framework';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { mutate } from 'swr';
import { type Config } from '../config-schema';
import {
  assertEmergencyQueueEntryActive,
  type EmergencyQueueEntry,
  EmergencyQueueEntryPreconditionError,
  endEmergencyQueueEntry,
} from '../resources/emergency.resource';
import {
  clearAttentionCheckpoint,
  loadAttentionCheckpoint,
  saveAttentionCheckpoint,
} from './attention-reconciliation-checkpoint';
import {
  createAttentionEncounter,
  isDefinitiveAttentionCreateRejection,
  verifyAttentionEncounter,
} from './attention-form.resource';
import { type AttentionFormData, attentionFormSchema } from './attention-form.validation';
import styles from './attention-form.workspace.scss';

/** Props for the attention form workspace, extending the default OpenMRS workspace props. */
interface AttentionFormWorkspaceProps extends DefaultWorkspaceProps {
  queueEntry: EmergencyQueueEntry;
}

const AttentionFormWorkspace: React.FC<AttentionFormWorkspaceProps> = ({ queueEntry, closeWorkspace }) => {
  const { t } = useTranslation();
  const config = useConfig<Config>();
  const [initialCheckpoint] = useState(() => loadAttentionCheckpoint(queueEntry));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedEncounterUuid, setSavedEncounterUuid] = useState<string | undefined>(() =>
    initialCheckpoint?.state === 'encounter-returned' ? initialCheckpoint.encounterUuid : undefined,
  );
  const [requiresClinicalRecordReview, setRequiresClinicalRecordReview] = useState(
    initialCheckpoint?.state === 'create-unverified',
  );
  const [queueEntryRequiresReview, setQueueEntryRequiresReview] = useState(false);
  const [checkpointIsDurable, setCheckpointIsDurable] = useState(true);
  const submitInFlightRef = useRef(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AttentionFormData>({
    resolver: zodResolver(attentionFormSchema),
  });

  const patientDisplay = queueEntry.patient?.person?.display || queueEntry.patient?.display || '';
  const patientAge = queueEntry.patient?.person?.age;
  const patientGender = queueEntry.patient?.person?.gender;
  const hasPartialClinicalWrite = Boolean(savedEncounterUuid) || requiresClinicalRecordReview;
  const clinicalFieldsAreLocked = isSubmitting || hasPartialClinicalWrite || queueEntryRequiresReview;

  useEffect(() => {
    if (!hasPartialClinicalWrite) {
      return;
    }

    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    globalThis.addEventListener('beforeunload', warnBeforeLeaving);
    return () => globalThis.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [hasPartialClinicalWrite]);

  const onSubmit = useCallback(
    async (data?: AttentionFormData) => {
      if (submitInFlightRef.current || requiresClinicalRecordReview || queueEntryRequiresReview) {
        return;
      }

      submitInFlightRef.current = true;
      setIsSubmitting(true);
      let encounterWasSaved = Boolean(savedEncounterUuid);
      let encounterIdentityWasVerified = false;
      let encounterPersistenceIsUnverified = false;
      let createWasDefinitivelyRejected = false;
      let queuePreconditionFailed = false;

      try {
        const { attentionEncounter, emergencyLocationUuid } = config;
        const visitUuid = queueEntry.visit?.uuid;

        if (!visitUuid) {
          showSnackbar({
            title: t('errorSavingAttention', 'Error al guardar atención'),
            subtitle: t('noVisitFound', 'No se encontró una consulta activa para este paciente'),
            kind: 'error',
          });
          return;
        }

        let encounterUuid = savedEncounterUuid;
        if (!encounterUuid) {
          if (!data) {
            return;
          }
          try {
            await assertEmergencyQueueEntryActive(queueEntry.uuid, {
              patientUuid: queueEntry.patient.uuid,
              visitUuid,
              queueUuid: queueEntry.queue.uuid,
              statusUuid: queueEntry.status.uuid,
            });

            const response = await createAttentionEncounter({
              patientUuid: queueEntry.patient.uuid,
              visitUuid,
              encounterTypeUuid: attentionEncounter.encounterTypeUuid,
              locationUuid: emergencyLocationUuid,
              observations: [
                { conceptUuid: attentionEncounter.concepts.diagnosisUuid, value: data.diagnosis },
                { conceptUuid: attentionEncounter.concepts.treatmentUuid, value: data.treatment },
                { conceptUuid: attentionEncounter.concepts.auxiliaryExamsUuid, value: data.auxiliaryExams || '' },
              ],
            });
            encounterUuid = response.data?.uuid?.trim();

            if (!encounterUuid) {
              encounterPersistenceIsUnverified = true;
              throw new Error('The emergency attention response did not include an encounter UUID.');
            }

            encounterWasSaved = true;
            setSavedEncounterUuid(encounterUuid);
            setCheckpointIsDurable(
              saveAttentionCheckpoint({
                version: 1,
                state: 'encounter-returned',
                queueEntryUuid: queueEntry.uuid,
                patientUuid: queueEntry.patient.uuid,
                visitUuid,
                encounterUuid,
              }),
            );
          } catch (error) {
            if (!encounterWasSaved) {
              if (error instanceof EmergencyQueueEntryPreconditionError) {
                queuePreconditionFailed = true;
                setQueueEntryRequiresReview(true);
              } else if (isDefinitiveAttentionCreateRejection(error)) {
                createWasDefinitivelyRejected = true;
                clearAttentionCheckpoint(queueEntry.uuid);
              } else {
                encounterPersistenceIsUnverified = true;
                setRequiresClinicalRecordReview(true);
                setCheckpointIsDurable(
                  saveAttentionCheckpoint({
                    version: 1,
                    state: 'create-unverified',
                    queueEntryUuid: queueEntry.uuid,
                    patientUuid: queueEntry.patient.uuid,
                    visitUuid,
                  }),
                );
              }
            }
            throw error;
          }
        }

        await verifyAttentionEncounter(encounterUuid, {
          patientUuid: queueEntry.patient.uuid,
          visitUuid,
          encounterTypeUuid: attentionEncounter.encounterTypeUuid,
          locationUuid: emergencyLocationUuid,
        });
        encounterIdentityWasVerified = true;
        await endEmergencyQueueEntry(queueEntry.uuid, {
          patientUuid: queueEntry.patient.uuid,
          visitUuid,
          queueUuid: queueEntry.queue.uuid,
          statusUuid: queueEntry.status.uuid,
        });
        clearAttentionCheckpoint(queueEntry.uuid);

        mutate((key) => typeof key === 'string' && key.includes('queue-entry'));

        showSnackbar({
          title: t('attentionSaved', 'Atención registrada'),
          subtitle: t('attentionSavedSubtitle', 'La atención de emergencia ha sido guardada correctamente.'),
          kind: 'success',
          timeoutInMs: 5000,
        });

        closeWorkspace();
      } catch (error: unknown) {
        let fallback: string;
        if (queuePreconditionFailed) {
          fallback = t(
            'attentionQueueEntryInactiveSubtitle',
            'La entrada ya no está activa o cambió. Actualice la cola y revise la historia antes de registrar otra atención.',
          );
        } else if (createWasDefinitivelyRejected) {
          fallback = t(
            'attentionCreateRejectedSubtitle',
            'El servidor rechazó el registro y no confirmó una atención nueva. Revise los datos y permisos antes de reintentar.',
          );
        } else if (encounterWasSaved && !encounterIdentityWasVerified) {
          fallback = t(
            'attentionEncounterVerificationFailureSubtitle',
            'El servidor devolvió una atención, pero no se pudo verificar que corresponda a este paciente y visita. No repita el registro; revise la historia clínica.',
          );
        } else if (encounterWasSaved) {
          fallback = t(
            'attentionQueueUpdateFailureSubtitle',
            'La atención clínica fue guardada, pero no se pudo actualizar la cola. Verifique su estado antes de reintentar.',
          );
        } else if (encounterPersistenceIsUnverified) {
          fallback = t(
            'attentionSaveUnverifiedSubtitle',
            'No se pudo confirmar si la atención clínica fue guardada. Revise la historia del paciente antes de repetir la acción.',
          );
        } else {
          fallback = t(
            'attentionSaveFailureSubtitle',
            'No se pudo completar la atención de emergencia. Revise la historia clínica y el estado de la cola antes de reintentar.',
          );
        }

        showSnackbar({
          title: t('errorSavingAttention', 'Error al guardar atención'),
          subtitle: getUserFacingErrorMessage(error, fallback, { logContext: 'Save emergency attention' }),
          kind: 'error',
        });
      } finally {
        submitInFlightRef.current = false;
        setIsSubmitting(false);
      }
    },
    [closeWorkspace, config, queueEntry, queueEntryRequiresReview, requiresClinicalRecordReview, savedEncounterUuid, t],
  );

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <div className={styles.container}>
        {savedEncounterUuid ? (
          <InlineNotification
            hideCloseButton
            kind="warning"
            lowContrast
            title={t('attentionQueueClosurePendingTitle', 'Atención pendiente de conciliación')}
            subtitle={t(
              'attentionQueueClosurePendingSubtitle',
              'No vuelva a registrar la atención. Verifique el registro ya devuelto por el servidor y complete el cierre de la cola.',
            )}
          />
        ) : null}
        {requiresClinicalRecordReview ? (
          <InlineNotification
            hideCloseButton
            kind="error"
            lowContrast
            title={t('attentionReconciliationRequiredTitle', 'Verifique el registro clínico antes de continuar')}
            subtitle={t(
              'attentionSaveUnverifiedSubtitle',
              'No se pudo confirmar si la atención clínica fue guardada. Revise la historia del paciente antes de repetir la acción.',
            )}
          />
        ) : null}
        {queueEntryRequiresReview ? (
          <InlineNotification
            hideCloseButton
            kind="error"
            lowContrast
            title={t('attentionQueueEntryInactiveTitle', 'La entrada de cola cambió')}
            subtitle={t(
              'attentionQueueEntryInactiveSubtitle',
              'La entrada ya no está activa o cambió. Actualice la cola y revise la historia antes de registrar otra atención.',
            )}
          />
        ) : null}
        {!checkpointIsDurable && hasPartialClinicalWrite ? (
          <InlineNotification
            hideCloseButton
            kind="error"
            lowContrast
            title={t('attentionCheckpointUnavailableTitle', 'No cierre ni recargue esta ventana')}
            subtitle={t(
              'attentionCheckpointUnavailableSubtitle',
              'El navegador no pudo conservar el estado pendiente. Reintente la conciliación o contacte a soporte sin repetir el registro clínico.',
            )}
          />
        ) : null}
        {/* Patient header */}
        <div className={styles.patientHeader}>
          <div>
            <h5>{patientDisplay}</h5>
            <span className={styles.patientMeta}>
              {patientAge !== undefined && patientAge !== null ? `${patientAge} ${t('years', 'años')}` : ''}
              {patientGender === 'M' ? t('male', 'Masculino') : patientGender === 'F' ? t('female', 'Femenino') : ''}
              {' — '}
              {queueEntry.priority?.display}
            </span>
          </div>
        </div>

        <Stack gap={5}>
          {/* Diagnóstico(s) */}
          <fieldset className={styles.formSection}>
            <legend className={styles.sectionTitle}>{t('diagnosis', 'Diagnóstico(s)')}</legend>
            <TextArea
              id="diagnosis"
              labelText={t('diagnosisLabel', 'Diagnóstico(s) del paciente')}
              placeholder={t('diagnosisPlaceholder', 'Ej: J18.9 - Neumonía no especificada, R50.9 - Fiebre')}
              rows={3}
              invalid={!!errors.diagnosis}
              invalidText={errors.diagnosis?.message}
              disabled={clinicalFieldsAreLocked}
              {...register('diagnosis')}
            />
          </fieldset>

          {/* Tratamiento */}
          <fieldset className={styles.formSection}>
            <legend className={styles.sectionTitle}>{t('treatment', 'Tratamiento')}</legend>
            <TextArea
              id="treatment"
              labelText={t('treatmentLabel', 'Plan de tratamiento')}
              placeholder={t('treatmentPlaceholder', 'Medicamentos, procedimientos, indicaciones...')}
              rows={5}
              invalid={!!errors.treatment}
              invalidText={errors.treatment?.message}
              disabled={clinicalFieldsAreLocked}
              {...register('treatment')}
            />
          </fieldset>

          {/* Exámenes auxiliares */}
          <fieldset className={styles.formSection}>
            <legend className={styles.sectionTitle}>{t('auxiliaryExams', 'Exámenes auxiliares')}</legend>
            <TextArea
              id="auxiliaryExams"
              labelText={t('auxiliaryExamsLabel', 'Exámenes solicitados o realizados')}
              placeholder={t('auxiliaryExamsPlaceholder', 'Laboratorio, imágenes, otros...')}
              rows={3}
              disabled={clinicalFieldsAreLocked}
              {...register('auxiliaryExams')}
            />
          </fieldset>
        </Stack>

        {/* Actions */}
        <div className={styles.formActions}>
          <Button
            type="button"
            kind="secondary"
            onClick={() => closeWorkspace()}
            disabled={isSubmitting || (!checkpointIsDurable && hasPartialClinicalWrite)}
          >
            {hasPartialClinicalWrite || queueEntryRequiresReview
              ? t('closeAndReturn', 'Cerrar y volver a la cola')
              : t('cancel', 'Cancelar')}
          </Button>
          <Button
            type={savedEncounterUuid ? 'button' : 'submit'}
            onClick={savedEncounterUuid ? () => void onSubmit() : undefined}
            disabled={isSubmitting || requiresClinicalRecordReview || queueEntryRequiresReview}
          >
            {isSubmitting ? (
              <InlineLoading description={t('saving', 'Guardando...')} />
            ) : savedEncounterUuid ? (
              t('reconcileAttentionAndQueue', 'Verificar atención y cerrar cola')
            ) : (
              t('saveAttention', 'Guardar atención')
            )}
          </Button>
        </div>
      </div>
    </Form>
  );
};

export default AttentionFormWorkspace;
