import classNames from 'classnames';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import React, { useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { SelectedDateContext } from '@openmrs/esm-patient-common-lib';

import type { PatientAppointment } from '../../../types';
import { isSameMonth } from '../../../utils/utils';

import styles from './monthly-view-workload.scss';

export interface MonthlyWorkloadViewProps {
  events: Array<PatientAppointment>;
  dateTime: Dayjs;
  showAllServices?: boolean;
}

const MonthlyWorkloadView: React.FC<MonthlyWorkloadViewProps> = ({ dateTime, events }) => {
  const { t } = useTranslation();
  const { selectedDate } = useContext(SelectedDateContext);

  const currentData = useMemo(
    () =>
      events?.find(
        (event) => dayjs(event.appointmentDate)?.format('YYYY-MM-DD') === dayjs(dateTime)?.format('YYYY-MM-DD'),
      ),
    [dateTime, events],
  );

  const handleAppoiment = (_serviceUuid: string) => {};

  return (
    <div
      onClick={() => handleAppoiment('')}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleAppoiment('');
        }
      }}
      role="button"
      tabIndex={0}
      className={classNames(
        styles[isSameMonth(dateTime, dayjs(selectedDate)) ? 'monthly-cell' : 'monthly-cell-disabled'],
        styles.largeDesktop,
      )}
    >
      {isSameMonth(dateTime, dayjs(selectedDate)) && (
        <div>
          <span className={classNames(styles.totals)}>
            <b className={styles.calendarDate}>{dateTime.format('D')}</b>
          </span>
          {currentData && (
            <div className={styles.currentData}>
              <div
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  handleAppoiment(currentData.appointmentId);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    event.stopPropagation();
                    handleAppoiment(currentData.appointmentId);
                  }
                }}
                className={styles.serviceArea}
              >
                <span>{t('attendAppointment', 'Atender Cita')}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MonthlyWorkloadView;
