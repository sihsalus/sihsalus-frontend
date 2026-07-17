import { formatDate, formatDatetime, usePatient } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getGender } from '../../helpers';
import { usePatientAppointmentHistory } from '../../hooks/usePatientAppointmentHistory';
import { type Appointment } from '../../types';

import styles from './appointment-details.scss';

interface AppointmentDetailsProps {
  appointment: Appointment;
}

interface ExactAgeLabels {
  day: string;
  days: string;
  month: string;
  months: string;
  year: string;
  years: string;
}

export function formatExactAge(
  birthDate: string | Date,
  referenceDate: string | number | Date,
  labels: ExactAgeLabels,
): string {
  const birth = dayjs(birthDate).startOf('day');
  const reference = dayjs(referenceDate).startOf('day');

  if (!birth.isValid() || !reference.isValid() || birth.isAfter(reference)) {
    return '';
  }

  const years = reference.diff(birth, 'year');
  const afterYears = birth.add(years, 'year');
  const months = reference.diff(afterYears, 'month');
  const afterMonths = afterYears.add(months, 'month');
  const days = reference.diff(afterMonths, 'day');
  const formatUnit = (value: number, singular: string, plural: string) =>
    `${value} ${value === 1 ? singular : plural}`;

  return [
    formatUnit(years, labels.year, labels.years),
    formatUnit(months, labels.month, labels.months),
    formatUnit(days, labels.day, labels.days),
  ].join(' ');
}

const AppointmentDetails: React.FC<AppointmentDetailsProps> = ({ appointment }) => {
  const { t } = useTranslation();
  const [, setIsEnabledQuery] = useState(false);
  const { appointmentsCount, isLoading } = usePatientAppointmentHistory(appointment.patient.uuid);
  const { patient } = usePatient(appointment.patient.uuid);
  const exactAge = patient?.birthDate
    ? formatExactAge(patient.birthDate, appointment.startDateTime, {
        day: t('ageDay', 'day'),
        days: t('ageDays', 'days'),
        month: t('ageMonth', 'month'),
        months: t('ageMonths', 'months'),
        year: t('ageYear', 'year'),
        years: t('ageYears', 'years'),
      })
    : '';

  useEffect(() => {
    if (!isLoading) {
      setIsEnabledQuery(true);
    }
  }, [isLoading]);

  return (
    <div className={styles.appointmentDetailsContainer}>
      <p className={styles.title}>{appointment.service.name}</p>
      <p className={styles.subTitle}>{formatDatetime(new Date(appointment.startDateTime))}</p>

      <div className={styles.patientInfoGrid}>
        <div>
          <p className={styles.gridTitle}>{t('patientDetails', 'Patient details')}</p>
          <div className={styles.labelContainer}>
            <p className={styles.labelBold}>{t('patientName', 'Patient name')}: </p>
            <p className={styles.label}>{appointment.patient.name}</p>
          </div>
          <div className={styles.labelContainer}>
            <p className={styles.labelBold}>{t('age', 'Age')}: </p>
            <p className={styles.label}>{exactAge || appointment.patient.age || '—'}</p>
          </div>
          <div className={styles.labelContainer}>
            <p className={styles.labelBold}>{t('gender', 'Gender')}: </p>
            <p className={styles.label}>{getGender(appointment.patient.gender, t)}</p>
          </div>
          {patient && patient?.birthDate ? (
            <div className={styles.labelContainer}>
              <p className={styles.labelBold}>{t('dateOfBirth', 'Date of birth')}: </p>
              <p className={styles.label}>{formatDate(new Date(patient.birthDate))}</p>
            </div>
          ) : (
            ''
          )}
          {patient && patient?.telecom
            ? patient.telecom.map((contact, i) => (
                <div key={i} className={styles.labelContainer}>
                  <p className={styles.labelBold}>{t('Contact', 'Contact {{index}}', { index: i + 1 })}: </p>
                  <p className={styles.label}>{contact.value}</p>
                </div>
              ))
            : ''}
        </div>
        <div>
          <p className={styles.gridTitle}>{t('appointmentNotes', 'Appointment Notes')}</p>
          <p className={styles.label}>{appointment.comments}</p>
        </div>
        <div>
          <p className={styles.gridTitle}>{t('appointmentHistory', 'Appointment History')}</p>
          <div className={styles.historyGrid}>
            <div>
              <p className={styles.historyGridLabel}>{t('completed', 'Completed')}</p>
              <span className={styles.historyGridCount}>{appointmentsCount.completedAppointments}</span>
            </div>
            <div>
              <p className={styles.historyGridLabel}>{t('missed', 'Missed')}</p>
              <span className={styles.historyGridCountRed}>{appointmentsCount.missedAppointments}</span>
            </div>
            <div>
              <p className={styles.historyGridLabel}>{t('cancelled', 'Cancelled')}</p>
              <span className={styles.historyGridCount}>{appointmentsCount.cancelledAppointments}</span>
            </div>
            <div>
              <p className={styles.historyGridLabel}>{t('upcoming', 'Upcoming')}</p>
              <span className={styles.historyGridCount}>{appointmentsCount.upcomingAppointments}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppointmentDetails;
