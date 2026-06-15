import { DatePicker, DatePickerInput } from '@carbon/react';
import { Location, UserFollow } from '@carbon/react/icons';
import { PageHeader, PageHeaderContent, PaymentsDeskPictogram, useSession } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import React, { useContext } from 'react';
import { omrsDateFormat } from '../constants';
import SelectedDateContext from '../hooks/selectedDateContext';
import styles from './billing-header.scss';

interface BillingHeaderProps {
  title: string;
}

const BillingHeader: React.FC<BillingHeaderProps> = ({ title }) => {
  const session = useSession();
  const location = session?.sessionLocation?.display;
  const { selectedDate, setSelectedDate } = useContext(SelectedDateContext);

  return (
    <PageHeader className={styles.header} data-testid="billing-header">
      <PageHeaderContent title={title} illustration={<PaymentsDeskPictogram />} />
      <div className={styles.rightJustifiedItems}>
        <div className={styles.userContainer}>
          <p>{session?.user?.person?.display}</p>
          <UserFollow size={16} className={styles.userIcon} />
        </div>
        <div className={styles.dateAndLocation}>
          <Location size={16} />
          <span className={styles.value}>{location}</span>
          <span className={styles.middot}>&middot;</span>
          <DatePicker
            onChange={([date]) => setSelectedDate(dayjs(date).startOf('day').format(omrsDateFormat))}
            value={dayjs(selectedDate).format('DD MMM YYYY')}
            dateFormat="d-M-Y"
            datePickerType="single"
          >
            <DatePickerInput
              style={{ cursor: 'pointer', backgroundColor: 'transparent', border: 'none', maxWidth: '10rem' }}
              id="appointment-date-picker"
              placeholder="DD-MMM-YYYY"
              labelText=""
              type="text"
            />
          </DatePicker>
        </div>
      </div>
    </PageHeader>
  );
};

export default BillingHeader;
