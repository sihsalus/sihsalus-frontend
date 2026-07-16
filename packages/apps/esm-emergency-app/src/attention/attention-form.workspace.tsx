/**
 * Emergency Attention Form Workspace.
 *
 * Opened from the Attention Queue when a doctor clicks "Atender" or "Atención de emergencia".
 * Captures diagnosis, treatment plan, and auxiliary exams as text observations
 * in an "Atención en Emergencia" encounter linked to the patient's emergency visit.
 */

import { Button, Form, InlineLoading, Stack, TextArea } from '@carbon/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { type DefaultWorkspaceProps, showSnackbar, useConfig } from '@openmrs/esm-framework';
import React, { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { type Config } from '../config-schema';
import {
  type EmergencyQueueEntry,
  endEmergencyQueueEntry,
  stopEmergencyVisit,
  useMutateEmergencyQueueEntries,
} from '../resources/emergency.resource';
import { createAttentionEncounter } from './attention-form.resource';
import { type AttentionFormData, attentionFormSchema } from './attention-form.validation';
import styles from './attention-form.workspace.scss';

/** Props for the attention form workspace, extending the default OpenMRS workspace props. */
interface AttentionFormWorkspaceProps extends DefaultWorkspaceProps {
  queueEntry: EmergencyQueueEntry;
}

const AttentionFormWorkspace: React.FC<AttentionFormWorkspaceProps> = ({ queueEntry, closeWorkspace }) => {
  const { t } = useTranslation();
  const config = useConfig<Config>();
  const { mutateEmergencyQueueEntries } = useMutateEmergencyQueueEntries();
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const onSubmit = useCallback(
    async (data: AttentionFormData) => {
      setIsSubmitting(true);
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

        await createAttentionEncounter({
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

        await endEmergencyQueueEntry(queueEntry.uuid);

        if (config.closeVisitOnDisposition) {
          try {
            await stopEmergencyVisit(visitUuid);
          } catch {
            // The encounter and queue entry are already saved; only the visit stayed open
            showSnackbar({
              title: t('attentionSavedVisitOpen', 'Atención registrada, visita sin cerrar'),
              subtitle: t(
                'couldNotCloseVisit',
                'No se pudo cerrar la visita de emergencia. Ciérrela manualmente desde la ficha del paciente.',
              ),
              kind: 'warning',
            });
          }
        }

        void mutateEmergencyQueueEntries();

        showSnackbar({
          title: t('attentionSaved', 'Atención registrada'),
          subtitle: t('attentionSavedSubtitle', 'La atención de emergencia ha sido guardada correctamente.'),
          kind: 'success',
          timeoutInMs: 5000,
        });

        closeWorkspace();
      } catch (error) {
        showSnackbar({
          title: t('errorSavingAttention', 'Error al guardar atención'),
          subtitle: error?.message || t('unknownError', 'Error desconocido'),
          kind: 'error',
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [config, queueEntry, t, closeWorkspace, mutateEmergencyQueueEntries],
  );

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <div className={styles.container}>
        {/* Patient header */}
        <div className={styles.patientHeader}>
          <div>
            <h5>{patientDisplay}</h5>
            <span className={styles.patientMeta}>
              {patientAge ? `${patientAge} ${t('years', 'años')}` : ''}
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
              disabled={isSubmitting}
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
              disabled={isSubmitting}
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
              disabled={isSubmitting}
              {...register('auxiliaryExams')}
            />
          </fieldset>
        </Stack>

        {/* Actions */}
        <div className={styles.formActions}>
          <Button kind="secondary" onClick={() => closeWorkspace()} disabled={isSubmitting}>
            {t('cancel', 'Cancelar')}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <InlineLoading description={t('saving', 'Guardando...')} />
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
