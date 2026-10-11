import {
  Button,
  InlineLoading,
  InlineNotification,
  StructuredListBody,
  StructuredListCell,
  StructuredListRow,
  StructuredListWrapper,
  Tag,
} from '@carbon/react';
import { Add, Calendar } from '@carbon/react/icons';
import { showSnackbar, useConfig, userHasAccess, useSession } from '@openmrs/esm-framework';
import { CardHeader, useLaunchWorkspaceRequiringVisit } from '@openmrs/esm-patient-common-lib';
import dayjs from 'dayjs';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../../../config-schema';
import { credCourseLifeEditPrivilege } from '../../../constants';
import { useCREDSchedule } from '../../../hooks/useCREDSchedule';
import { useMutateAppointments } from '../../../ui/form/appointments-form.resource';
import styles from '../../../ui/summary-card.scss';
import { getCREDControlsToSchedule } from '../../../utils/cred-control-intervals';
import { translateCredControlLabel } from '../../../utils/cred-label-translations';
import { createCREDAppointments } from '../../common/cred-appointments.resource';

interface CredCheckupsProps {
  patientUuid: string;
}

const CredCheckups: React.FC<CredCheckupsProps> = ({ patientUuid }) => {
  const { t } = useTranslation('@sihsalus/esm-cred-app');
  const config = useConfig<ConfigObject>();
  const session = useSession();
  const canEdit = userHasAccess(credCourseLifeEditPrivilege, session?.user);
  const { controls, nextDueControl, completedCount, totalCount, isLoading, error, missingNeonatalDischarge } =
    useCREDSchedule(patientUuid);
  const launchControlWorkspace = useLaunchWorkspaceRequiringVisit<{
    workspaceTitle: string;
    patientUuid: string;
    control: typeof nextDueControl;
    type: 'newControl';
  }>(patientUuid, 'wellchild-control-form');
  const { mutateAppointments } = useMutateAppointments();

  const [isGenerating, setIsGenerating] = useState(false);

  const controlsToSchedule = useMemo(() => getCREDControlsToSchedule(nextDueControl), [nextDueControl]);

  const scheduledControls = useMemo(() => controls.filter((c) => c.status === 'scheduled'), [controls]);
  const canRegisterNextControl = Boolean(
    nextDueControl &&
      (nextDueControl.controlNumber === 1 || !dayjs().isBefore(dayjs(nextDueControl.targetDate), 'day')),
  );

  const handleRegisterControl = useCallback(() => {
    if (!canRegisterNextControl) return;

    launchControlWorkspace({
      workspaceTitle: t('newCredEncounter', 'Nuevo Control Crecimiento y Desarrollo'),
      patientUuid,
      control: nextDueControl,
      type: 'newControl',
    });
  }, [canRegisterNextControl, launchControlWorkspace, nextDueControl, patientUuid, t]);

  const handleGenerateAppointments = useCallback(async () => {
    const serviceUuid = config.credScheduling?.appointmentServiceUuid;
    if (!serviceUuid) {
      showSnackbar({
        title: t('configError', 'Error de configuración'),
        subtitle: t(
          'noAppointmentServiceUuid',
          'No se ha configurado el UUID del servicio de citas Crecimiento y Desarrollo.',
        ),
        kind: 'error',
      });
      return;
    }

    const locationUuid = config.credScheduling?.appointmentLocationUuid;
    if (!locationUuid) {
      showSnackbar({
        title: t('locationError', 'Error de UPSS'),
        subtitle: t('noAppointmentLocationUuid', 'No se configuró la UPSS asistencial para las citas CRED.'),
        kind: 'error',
      });
      return;
    }

    if (controlsToSchedule.length === 0) {
      showSnackbar({
        title: t('noControlsToSchedule', 'Sin controles pendientes'),
        subtitle: t('allControlsScheduled', 'No hay controles pendientes para programar.'),
        kind: 'info',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const result = await createCREDAppointments(
        patientUuid,
        controlsToSchedule,
        serviceUuid,
        locationUuid,
        config.credScheduling?.defaultAppointmentDurationMins ?? 30,
      );

      if (result.created.length > 0) {
        showSnackbar({
          title: t('appointmentsCreated', 'Cita creada'),
          subtitle: t('appointmentsCreatedDetail', 'La cita Crecimiento y Desarrollo se creó correctamente.', {
            count: result.created.length,
          }),
          kind: 'success',
        });
        mutateAppointments();
      }

      if (result.errors.length > 0) {
        showSnackbar({
          title: t('someAppointmentsFailed', 'No se pudo crear la cita'),
          subtitle: t('appointmentsFailedDetail', 'La cita Crecimiento y Desarrollo no pudo crearse.', {
            count: result.errors.length,
          }),
          kind: 'warning',
        });
      }
    } catch (err) {
      showSnackbar({
        title: t('appointmentError', 'Error al crear citas'),
        subtitle: (err as Error).message,
        kind: 'error',
      });
    } finally {
      setIsGenerating(false);
    }
  }, [config, controlsToSchedule, patientUuid, mutateAppointments, t]);

  if (isLoading)
    return <InlineLoading description={t('loadingSchedule', 'Cargando calendario Crecimiento y Desarrollo...')} />;
  if (error) return <InlineNotification kind="error" title={t('errorLoadingSchedule', 'Error cargando calendario')} />;

  return (
    <div className={styles.widgetCard}>
      <CardHeader title={t('credCheckups', 'Controles de crecimiento y desarrollo')}>
        <div className={styles.headerActions}>
          {nextDueControl?.status === 'overdue' && (
            <Tag type="red" size="sm">
              {t('statusOverdue', 'Vencido')}
            </Tag>
          )}
          {nextDueControl?.status === 'pending' && (
            <Tag type="green" size="sm">
              {t('statusPending', 'Pendiente')}
            </Tag>
          )}
          {nextDueControl?.status === 'scheduled' && (
            <Tag type="blue" size="sm">
              {t('statusScheduled', 'Programado')}
            </Tag>
          )}
          {nextDueControl?.status === 'future' && (
            <Tag type="gray" size="sm">
              {t('statusFuture', 'Futuro')}
            </Tag>
          )}
          {canEdit && nextDueControl && (
            <Button
              kind="ghost"
              size="sm"
              renderIcon={Add}
              onClick={handleRegisterControl}
              disabled={!canRegisterNextControl}
            >
              {t('registerControl', 'Registrar control')}
            </Button>
          )}
        </div>
      </CardHeader>
      <div className={styles.container}>
        {missingNeonatalDischarge && (
          <InlineNotification kind="warning" lowContrast hideCloseButton title={t('neonatalDischargeRequired')} />
        )}
        {nextDueControl && (
          <StructuredListWrapper isCondensed>
            <StructuredListBody>
              <StructuredListRow>
                <StructuredListCell className={styles.label}>
                  {t('nextDueControl', 'Próximo control')}
                </StructuredListCell>
                <StructuredListCell className={styles.value}>
                  {t('credRecordedControlNumber', 'Control {{number}}', { number: nextDueControl.controlNumber })}
                </StructuredListCell>
              </StructuredListRow>
              <StructuredListRow>
                <StructuredListCell className={styles.label}>
                  {nextDueControl.controlNumber === 1
                    ? t('recommendedControlDate', 'Fecha recomendada')
                    : t('minimumControlDate', 'Fecha mínima')}
                </StructuredListCell>
                <StructuredListCell className={styles.value}>
                  {dayjs(nextDueControl.targetDate).format('DD/MM/YYYY')}
                </StructuredListCell>
              </StructuredListRow>
              {nextDueControl.appointmentDate && (
                <StructuredListRow>
                  <StructuredListCell className={styles.label}>
                    {t('appointmentDate', 'Fecha de cita')}
                  </StructuredListCell>
                  <StructuredListCell className={styles.value}>
                    {dayjs(nextDueControl.appointmentDate).format('DD/MM/YYYY')}
                  </StructuredListCell>
                </StructuredListRow>
              )}
            </StructuredListBody>
          </StructuredListWrapper>
        )}

        {/* Scheduled controls */}
        {scheduledControls.length > 0 && (
          <>
            <div className={styles.sectionTitle}>
              {t('scheduledControls', 'Citas programadas')} ({scheduledControls.length})
            </div>
            {scheduledControls.map((control) => (
              <div key={control.controlNumber} className={styles.summaryRow}>
                <span>
                  {t('idealAgeSlot', 'Edad programada')}: {translateCredControlLabel(t, control.label)}
                </span>
                <span className={styles.value}>
                  {control.appointmentDate ? dayjs(control.appointmentDate).format('DD/MM/YYYY') : ''}
                </span>
                <Tag type="blue">{t('statusScheduled', 'Programado')}</Tag>
              </div>
            ))}
          </>
        )}

        {/* Progress summary */}
        <div className={styles.sectionTitle}>{t('progressSummary', 'Resumen')}</div>
        <div className={styles.summaryRow}>
          <span>
            {t('completedOf', '{{completed}} de {{total}} controles', {
              completed: completedCount,
              total: totalCount,
            })}
          </span>
        </div>

        {/* Generate appointments button */}
        {canEdit && (
          <div className={styles.generateSection}>
            <Button
              kind="ghost"
              size="sm"
              renderIcon={Calendar}
              onClick={handleGenerateAppointments}
              disabled={isGenerating || controlsToSchedule.length === 0}
            >
              {isGenerating
                ? t('generatingAppointments', 'Generando citas...')
                : t('generateAppointments', 'Generar cita')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CredCheckups;
