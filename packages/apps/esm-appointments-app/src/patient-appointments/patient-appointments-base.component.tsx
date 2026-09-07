import { Button, ContentSwitcher, DataTableSkeleton, InlineLoading, Layer, Switch, Tile } from '@carbon/react';
import { Add } from '@carbon/react/icons';
import { launchWorkspace2, useLayoutType, userHasAccess, useSession } from '@openmrs/esm-framework';
import { CardHeader, EmptyDataIllustration, ErrorState, launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import dayjs from 'dayjs';
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { appointmentsEditPrivileges, chartAppointmentsEditPrivileges } from '../constants';
import PatientAppointmentContext, { PatientAppointmentContextTypes } from '../hooks/patientAppointmentContext';
import { usePatientAppointments } from './patient-appointments.resource';
import styles from './patient-appointments-base.scss';
import PatientAppointmentsTable from './patient-appointments-table.component';

interface PatientAppointmentsBaseProps {
  patientUuid: string;
}

enum AppointmentTypes {
  TODAY = 0,
  UPCOMING = 1,
  PAST = 2,
}

const PatientAppointmentsBase: React.FC<PatientAppointmentsBaseProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const session = useSession();
  const headerTitle = t('appointments', 'Appointments');
  const isTablet = useLayoutType() === 'tablet';
  const patientAppointmentContext = useContext(PatientAppointmentContext);
  const canEdit = userHasAccess(
    patientAppointmentContext === PatientAppointmentContextTypes.PATIENT_CHART
      ? chartAppointmentsEditPrivileges
      : appointmentsEditPrivileges,
    session?.user,
  );
  const [switchedView, setSwitchedView] = useState(false);

  const [contentSwitcherValue, setContentSwitcherValue] = useState(0);
  const [startDate] = useState(() => dayjs(new Date().toISOString()).subtract(6, 'month').toISOString());
  const abortController = useMemo(() => new AbortController(), []);
  useEffect(() => () => abortController.abort(), [abortController]);
  const {
    data: appointmentsData,
    error,
    isLoading,
    isValidating,
  } = usePatientAppointments(patientUuid, startDate, abortController);

  const handleLaunchAppointmentsForm = () => {
    const workspaceProps = {
      context: 'creating',
      patientUuid,
      workspaceTitle: t('createNewAppointment', 'Create new appointment'),
    };

    if (patientAppointmentContext === PatientAppointmentContextTypes.PATIENT_CHART) {
      launchPatientWorkspace('patient-chart-appointments-form-workspace', workspaceProps);
    } else {
      launchWorkspace2('appointments-form-workspace', workspaceProps);
    }
  };

  if (isLoading) {
    return <DataTableSkeleton role="progressbar" size={isTablet ? 'lg' : 'sm'} zebra />;
  }

  if (error) {
    return <ErrorState headerTitle={headerTitle} error={error} />;
  }

  if (appointmentsData && Object.keys(appointmentsData)?.length) {
    return (
      <div className={styles.widgetCard}>
        <CardHeader title={headerTitle}>
          {isValidating ? (
            <span>
              <InlineLoading />
            </span>
          ) : null}
          <div className={styles.contentSwitcherWrapper}>
            <ContentSwitcher
              size={isTablet ? 'md' : 'sm'}
              onChange={({ index }) => {
                setContentSwitcherValue(index);
                setSwitchedView(true);
              }}
            >
              <Switch name={'today'} text={t('today', 'Today')} />
              <Switch name={'upcoming'} text={t('upcoming', 'Upcoming')} />
              <Switch name={'past'} text={t('past', 'Past')} />
            </ContentSwitcher>
            <div className={styles.divider}>|</div>
            {canEdit ? (
              <Button
                kind="ghost"
                renderIcon={(props) => <Add size={16} {...props} />}
                iconDescription="Add Appointments"
                onClick={handleLaunchAppointmentsForm}
              >
                {t('add', 'Add')}
              </Button>
            ) : null}
          </div>
        </CardHeader>
        {(() => {
          if (contentSwitcherValue === AppointmentTypes.UPCOMING) {
            if (appointmentsData.upcomingAppointments?.length) {
              return (
                <PatientAppointmentsTable
                  patientAppointments={appointmentsData?.upcomingAppointments}
                  switchedView={switchedView}
                  setSwitchedView={setSwitchedView}
                  patientUuid={patientUuid}
                />
              );
            }
            return (
              <Layer>
                <Tile className={styles.tile}>
                  <EmptyDataIllustration />
                  <p className={styles.content}>
                    {t(
                      'noUpcomingAppointmentsForPatient',
                      'There are no upcoming appointments to display for this patient',
                    )}
                  </p>
                </Tile>
              </Layer>
            );
          }
          if (contentSwitcherValue === AppointmentTypes.TODAY) {
            if (appointmentsData.todaysAppointments?.length) {
              return (
                <PatientAppointmentsTable
                  patientAppointments={appointmentsData?.todaysAppointments}
                  switchedView={switchedView}
                  setSwitchedView={setSwitchedView}
                  patientUuid={patientUuid}
                  allowCheckIn={patientAppointmentContext === PatientAppointmentContextTypes.PATIENT_CHART}
                />
              );
            }
            return (
              <Layer>
                <Tile className={styles.tile}>
                  <EmptyDataIllustration />
                  <p className={styles.content}>
                    {t(
                      'noCurrentAppointments',
                      'There are no appointments scheduled for today to display for this patient',
                    )}
                  </p>
                </Tile>
              </Layer>
            );
          }

          if (contentSwitcherValue === AppointmentTypes.PAST) {
            if (appointmentsData.pastAppointments?.length) {
              return (
                <PatientAppointmentsTable
                  patientAppointments={appointmentsData?.pastAppointments}
                  switchedView={switchedView}
                  setSwitchedView={setSwitchedView}
                  patientUuid={patientUuid}
                />
              );
            }
            return (
              <Layer>
                <Tile className={styles.tile}>
                  <EmptyDataIllustration />
                  <p className={styles.content}>
                    {t('noPastAppointments', 'There are no past appointments to display for this patient')}
                  </p>
                </Tile>
              </Layer>
            );
          }
        })()}
      </div>
    );
  }
};

export default PatientAppointmentsBase;
