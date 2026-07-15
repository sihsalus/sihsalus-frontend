import {
  InlineNotification,
  StructuredListBody,
  StructuredListCell,
  StructuredListHead,
  StructuredListRow,
  StructuredListWrapper,
} from '@carbon/react';
import { formatDate, parseDate } from '@openmrs/esm-framework';
import { ErrorState } from '@openmrs/esm-patient-common-lib';
import dayjs from 'dayjs';
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { usePatientAppointments } from './patient-appointments.resource';
import styles from './patient-upcoming-appointments-card.scss';

// See VisitFormExtensionState in esm-patient-chart-app
export interface PatientUpcomingAppointmentsProps {
  setVisitFormCallbacks(callbacks: unknown);
  visitFormOpenedFrom: string;
  patientChartConfig?: {
    showUpcomingAppointments: boolean;
  };
  patientUuid: string;
}

/**
 * This is an extension that gets slotted into the patient chart start visit form when
 * the appropriate config values are enabled.
 * @param param0
 * @returns
 */
const PatientUpcomingAppointmentsCard: React.FC<PatientUpcomingAppointmentsProps> = ({
  patientUuid,
  patientChartConfig,
}) => {
  const { t } = useTranslation();
  // The date is part of the SWR key; recomputing it per render restarts the request on
  // every render and floods the backend with POST /appointments/search calls.
  const startDate = useMemo(() => dayjs().subtract(6, 'month').toISOString(), []);
  const headerTitle = t('upcomingAppointments', 'Upcoming appointments');
  const ac = useMemo<AbortController>(() => new AbortController(), []);
  useEffect(() => () => ac.abort(), [ac]);
  const { data: appointmentsData, error, isLoading } = usePatientAppointments(patientUuid, startDate, ac);

  const todaysAppointments = appointmentsData?.todaysAppointments?.length ? appointmentsData?.todaysAppointments : [];
  const futureAppointments = appointmentsData?.upcomingAppointments?.length
    ? appointmentsData?.upcomingAppointments
    : [];

  const appointments = todaysAppointments
    .concat(futureAppointments)
    .filter((appointment) => appointment.status !== 'CheckedIn');

  if (!patientChartConfig?.showUpcomingAppointments) {
    return <></>;
  }

  if (error) {
    return <ErrorState headerTitle={headerTitle} error={error} />;
  }
  if (isLoading) {
    return null;
  }

  if (appointments.length) {
    return (
      <div>
        <div>
          <p className={styles.sectionTitle}>{headerTitle}</p>
        </div>
        <StructuredListWrapper>
          <StructuredListHead>
            <StructuredListRow head>
              <StructuredListCell head>{t('date', 'Date')}</StructuredListCell>
              <StructuredListCell head>{t('appointmentType', 'Appointment type')}</StructuredListCell>
            </StructuredListRow>
          </StructuredListHead>
          <StructuredListBody>
            {appointments.map((appointment) => (
              <StructuredListRow key={appointment.uuid} className={styles.structuredList}>
                <StructuredListCell>
                  {formatDate(parseDate(String(appointment.startDateTime)), {
                    mode: 'wide',
                  })}
                </StructuredListCell>
                <StructuredListCell>{appointment.service ? appointment.service.name : '——'}</StructuredListCell>
              </StructuredListRow>
            ))}
          </StructuredListBody>
        </StructuredListWrapper>
      </div>
    );
  }

  return (
    <InlineNotification
      kind={'info'}
      lowContrast
      className={styles.inlineNotification}
      title={t('upcomingAppointments', 'Upcoming appointments')}
      subtitle={t('noUpcomingAppointments', 'No upcoming appointments found')}
    />
  );
};

export default PatientUpcomingAppointmentsCard;
