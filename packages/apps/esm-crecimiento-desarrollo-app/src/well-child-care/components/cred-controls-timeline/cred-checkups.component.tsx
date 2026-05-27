import { Button, InlineLoading, InlineNotification, Tag } from '@carbon/react';
import { Add, Calendar } from '@carbon/react/icons';
import { launchWorkspace2, showSnackbar, useConfig, useSession } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ConfigObject } from '../../../config-schema';
import { useCREDSchedule } from '../../../hooks/useCREDSchedule';
import { useMutateAppointments } from '../../../ui/form/appointments-form.resource';
import { translateCredControlLabel } from '../../../utils/cred-label-translations';
import { createCREDAppointments } from '../../common/cred-appointments.resource';

import styles from './cred-schedule.scss';

interface CredCheckupsProps {
  patientUuid: string;
}

const CredCheckups: React.FC<CredCheckupsProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();
  const session = useSession();
  const { controls, nextDueControl, overdueControls, completedCount, totalCount, isLoading, error } =
    useCREDSchedule(patientUuid);
  const { mutateAppointments } = useMutateAppointments();

  const [isGenerating, setIsGenerating] = useState(false);

  const pendingControls = useMemo(
    () => controls.filter((c) => c.status === 'overdue' || c.status === 'pending'),
    [controls],
  );

  const scheduledControls = useMemo(() => controls.filter((c) => c.status === 'scheduled'), [controls]);

  const handleRegisterControl = useCallback(() => {
    launchWorkspace2('wellchild-control-form', {
      workspaceTitle: t('newCredEncounter', 'Nuevo Control Crecimiento y Desarrollo'),
      patientUuid,
      type: 'newControl',
    });
  }, [patientUuid, t]);

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

    const locationUuid = session?.sessionLocation?.uuid;
    if (!locationUuid) {
      showSnackbar({
        title: t('locationError', 'Error de ubicación'),
        subtitle: t('noSessionLocation', 'No se pudo determinar la ubicación actual.'),
        kind: 'error',
      });
      return;
    }

    const lookahead = config.credScheduling?.lookaheadCount ?? 3;
    const controlsToSchedule = pendingControls.slice(0, lookahead);

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
          title: t('appointmentsCreated', 'Citas creadas'),
          subtitle: t(
            'appointmentsCreatedDetail',
            'Se crearon {{count}} citas Crecimiento y Desarrollo exitosamente.',
            {
              count: result.created.length,
            },
          ),
          kind: 'success',
        });
        mutateAppointments();
      }

      if (result.errors.length > 0) {
        showSnackbar({
          title: t('someAppointmentsFailed', 'Algunas citas fallaron'),
          subtitle: t('appointmentsFailedDetail', '{{count}} citas no pudieron crearse.', {
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
  }, [config, session, pendingControls, patientUuid, mutateAppointments, t]);

  if (isLoading)
    return <InlineLoading description={t('loadingSchedule', 'Cargando calendario Crecimiento y Desarrollo...')} />;
  if (error) return <InlineNotification kind="error" title={t('errorLoadingSchedule', 'Error cargando calendario')} />;

  return (
    <div className={styles.widgetCard}>
      <div className={styles.desktopHeading}>
        <h4>{t('credCheckups', 'Controles Crecimiento y Desarrollo')}</h4>
      </div>

      <div className={styles.checkups}>
        {/* Next due control */}
        {nextDueControl && (
          <>
            <div className={styles.sectionTitle}>{t('nextDueControl', 'Próximo Control')}</div>
            <div className={styles.nextDueCard}>
              <div className={styles.nextDueInfo}>
                <span className={styles.nextDueLabel}>
                  #{nextDueControl.controlNumber} - {translateCredControlLabel(t, nextDueControl.label)}
                </span>
                <span className={styles.nextDueDate}>
                  {t('expectedDate', 'Fecha esperada')}: {dayjs(nextDueControl.targetDate).format('DD/MM/YYYY')}
                </span>
              </div>
              <Button kind="primary" size="sm" renderIcon={Add} onClick={handleRegisterControl}>
                {t('registerControl', 'Registrar Control')}
              </Button>
            </div>
          </>
        )}

        {/* Overdue controls */}
        {overdueControls.length > 0 && (
          <>
            <div className={styles.sectionTitle}>
              {t('overdueControls', 'Controles Vencidos')} ({overdueControls.length})
            </div>
            <div className={styles.overdueList}>
              {overdueControls.map((control) => (
                <div key={control.controlNumber} className={styles.overdueItem}>
                  <div>
                    <span className={styles.overdueItemLabel}>
                      #{control.controlNumber} - {translateCredControlLabel(t, control.label)}
                    </span>
                    <div className={styles.overdueItemDate}>
                      {t('wasExpectedOn', 'Se esperaba el')} {dayjs(control.targetDate).format('DD/MM/YYYY')}
                    </div>
                  </div>
                  <Tag type="red">{t('statusOverdue', 'Vencido')}</Tag>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Scheduled controls */}
        {scheduledControls.length > 0 && (
          <>
            <div className={styles.sectionTitle}>
              {t('scheduledControls', 'Citas Programadas')} ({scheduledControls.length})
            </div>
            {scheduledControls.map((control) => (
              <div key={control.controlNumber} className={styles.checkupItem}>
                <span>
                  #{control.controlNumber} - {translateCredControlLabel(t, control.label)}
                </span>
                <span className={styles.dueDate}>
                  {control.appointmentDate ? dayjs(control.appointmentDate).format('DD/MM/YYYY') : ''}
                </span>
                <Tag type="blue">{t('statusScheduled', 'Programado')}</Tag>
              </div>
            ))}
          </>
        )}

        {/* Progress summary */}
        <div className={styles.sectionTitle}>{t('progressSummary', 'Resumen')}</div>
        <div className={styles.checkupItem}>
          <span>
            {t('completedOf', '{{completed}} de {{total}} controles', {
              completed: completedCount,
              total: totalCount,
            })}
          </span>
        </div>

        {/* Generate appointments button */}
        <div className={styles.generateSection}>
          <Button
            kind="tertiary"
            size="md"
            renderIcon={Calendar}
            onClick={handleGenerateAppointments}
            disabled={isGenerating || pendingControls.length === 0}
          >
            {isGenerating
              ? t('generatingAppointments', 'Generando citas...')
              : t('generateAppointments', 'Generar Citas Crecimiento y Desarrollo')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CredCheckups;
