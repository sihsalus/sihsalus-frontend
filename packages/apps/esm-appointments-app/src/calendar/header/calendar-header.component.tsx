import { Button } from '@carbon/react';
import { ArrowLeft } from '@carbon/react/icons';
import { navigate } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';

import { spaHomePage } from '../../constants';
import SelectedDateContext from '../../hooks/selectedDateContext';
import { getAppointmentServiceFilterSearch } from '../../hooks/useAppointmentServiceFilter';

import styles from './calendar-header.scss';

interface CalendarHeaderProps {
  appointmentServiceTypes: Array<string>;
}

const CalendarHeader: React.FC<CalendarHeaderProps> = ({ appointmentServiceTypes }) => {
  const { t } = useTranslation();
  const { selectedDate } = useContext(SelectedDateContext);

  const handleClick = () => {
    navigate({
      to: `${spaHomePage}/appointments/${dayjs(selectedDate).format('YYYY-MM-DD')}${getAppointmentServiceFilterSearch(
        appointmentServiceTypes,
      )}`,
    });
  };

  return (
    <div className={styles.calendarHeaderContainer}>
      <div className={styles.titleContainer}>
        <Button
          className={styles.backButton}
          iconDescription={t('back', 'Back')}
          kind="ghost"
          onClick={handleClick}
          renderIcon={ArrowLeft}
          size="lg"
        >
          <span>{t('back', 'Back')}</span>
        </Button>
      </div>
    </div>
  );
};

export default CalendarHeader;
