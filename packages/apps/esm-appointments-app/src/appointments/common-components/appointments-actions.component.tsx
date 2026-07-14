import { Button, InlineLoading } from '@carbon/react';
import { TaskComplete } from '@carbon/react/icons';
import { navigate, showModal, useConfig, userHasAccess, useSession } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import isToday from 'dayjs/plugin/isToday';
import utc from 'dayjs/plugin/utc';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { type ConfigObject } from '../../config-schema';
import { appointmentsEditPrivilege } from '../../constants';
import { canTransition } from '../../helpers';
import { type ActiveAppointmentVisit, useTodaysVisits } from '../../hooks/useTodaysVisits';
import { type Appointment, AppointmentStatus } from '../../types';

import styles from './appointments-actions.scss';
import CheckInButton from './checkin-button.component';

dayjs.extend(utc);
dayjs.extend(isToday);

const checkInPrivileges = [
  appointmentsEditPrivilege,
  'Get Patients',
  'Get Locations',
  'Get Visits',
  'Add Visits',
  'Edit Visits',
  'Get Visit Types',
  'Get Visit Attribute Types',
  'Get Queue Entries',
  'Get Queues',
  'Manage Queue Entries',
];
const checkOutPrivileges = [
  appointmentsEditPrivilege,
  'Get Visits',
  'Edit Visits',
  'Get Queue Entries',
  'Get Queues',
  'Manage Queue Entries',
];

interface AppointmentsActionsProps {
  appointment: Appointment;
  activeVisits?: Array<ActiveAppointmentVisit>;
  activeVisitsError?: unknown;
  activeVisitsLoading?: boolean;
  mutateActiveVisits?: () => void;
}

const AppointmentsActions: React.FC<AppointmentsActionsProps> = ({
  appointment,
  activeVisits: providedVisits,
  activeVisitsError,
  activeVisitsLoading,
  mutateActiveVisits,
}) => {
  const { t } = useTranslation();
  const { appointmentVisitAttributeTypeUuid, checkInButton, checkOutButton } = useConfig<ConfigObject>();
  const session = useSession();
  const canCheckIn = userHasAccess(checkInPrivileges, session?.user);
  const canCheckOut = userHasAccess(checkOutPrivileges, session?.user);
  const patientUuid = appointment.patient.uuid;
  const scopedVisits = useTodaysVisits(providedVisits ? [] : [patientUuid]);
  const visits = providedVisits ?? scopedVisits.visits;
  const visitsError = providedVisits ? activeVisitsError : scopedVisits.error;
  const visitsLoading = providedVisits ? Boolean(activeVisitsLoading) : scopedVisits.isLoading;
  const refreshVisits = mutateActiveVisits ?? scopedVisits.mutateVisit;
  const visitDate = dayjs(appointment.startDateTime);

  const hasActiveVisit = visits?.some(
    (visit) => visit?.patient?.uuid === patientUuid && visit?.startDatetime && !visit?.stopDatetime,
  );
  const hasLinkedActiveVisit = visits?.some(
    (visit) =>
      visit?.patient?.uuid === patientUuid &&
      visit?.startDatetime &&
      !visit?.stopDatetime &&
      Boolean(appointmentVisitAttributeTypeUuid) &&
      (visit.attributes ?? []).some(
        (attribute) =>
          attribute.attributeType?.uuid === appointmentVisitAttributeTypeUuid &&
          String(attribute.value ?? '').trim() === appointment.uuid,
      ),
  );

  const isTodaysAppointment = visitDate.isToday();
  const isCheckedIn = appointment.status === AppointmentStatus.CHECKEDIN;
  const isCompleted = appointment.status === AppointmentStatus.COMPLETED;
  const isCancelled = appointment.status === AppointmentStatus.CANCELLED;
  const isCheckInCandidate =
    canCheckIn &&
    checkInButton.enabled &&
    isTodaysAppointment &&
    canTransition(appointment.status, AppointmentStatus.CHECKEDIN);

  const handleCheckout = () => {
    if (checkOutButton.customUrl) {
      navigate({
        to: checkOutButton.customUrl,
        templateParams: {
          patientUuid,
          appointmentUuid: appointment.uuid,
        },
      });
    } else {
      const dispose = showModal('end-appointment-modal', {
        closeModal: () => {
          refreshVisits();
          dispose();
        },
        patientUuid,
        appointmentUuid: appointment.uuid,
      });
    }
  };

  const renderVisitStatus = () => {
    switch (true) {
      case isCancelled:
        return (
          <Button kind="danger--ghost" iconDescription={t('cancelled', 'Cancelled')} size="sm">
            {t('cancelled', 'Cancelled')}
          </Button>
        );

      case isCompleted:
        if (canCheckOut && hasLinkedActiveVisit) {
          return (
            <Button onClick={handleCheckout} kind="tertiary" size="sm">
              {t('reconcileCheckout', 'Regularizar cierre')}
            </Button>
          );
        }
        return (
          <Button kind="ghost" renderIcon={TaskComplete} iconDescription={t('checkedOut', 'Checked out')} size="sm">
            {t('checkedOut', 'Checked out')}
          </Button>
        );

      case canCheckOut && checkOutButton.enabled && isCheckedIn:
        return (
          <Button onClick={handleCheckout} kind="danger--tertiary" size="sm">
            {t('checkOut', 'Check out')}
          </Button>
        );

      case isCheckInCandidate && visitsLoading:
        return <InlineLoading description={t('checkingActiveVisit', 'Checking active visit')} />;

      case isCheckInCandidate && Boolean(visitsError):
        return (
          <Button disabled kind="ghost" size="sm">
            {t('activeVisitCheckFailed', 'Unable to verify active visit')}
          </Button>
        );

      case isCheckInCandidate && (!hasActiveVisit || checkInButton.showIfActiveVisit):
        return <CheckInButton patientUuid={patientUuid} appointment={appointment} mutateVisits={refreshVisits} />;

      default:
        return null;
    }
  };

  return <div className={styles.container}>{renderVisitStatus()}</div>;
};

export default AppointmentsActions;
