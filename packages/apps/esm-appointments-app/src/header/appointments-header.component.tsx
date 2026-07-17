import { MultiSelect } from '@carbon/react';
import { AppointmentsPictogram, OpenmrsDatePicker, PageHeader, PageHeaderContent } from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import React, { useCallback, useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { omrsDateFormat } from '../constants';
import SelectedDateContext from '../hooks/selectedDateContext';
import { useAppointmentServices } from '../hooks/useAppointmentService';

import styles from './appointments-header.scss';

interface AppointmentHeaderProps {
  title: string;
  appointmentServiceTypes?: Array<string>;
  onChange?: (selectedServiceTypes: Array<string>) => void;
}

type ServiceTypeOption = {
  id: string;
  label: string;
};

const AppointmentsHeader: React.FC<AppointmentHeaderProps> = ({ appointmentServiceTypes = [], title, onChange }) => {
  const { t } = useTranslation();
  const { selectedDate, setSelectedDate } = useContext(SelectedDateContext);
  const { serviceTypes } = useAppointmentServices();

  const handleMultiSelectChange = useCallback(
    ({ selectedItems }: { selectedItems: Array<ServiceTypeOption> | null }) => {
      const selectedUuids = selectedItems?.map((item) => item.id) ?? [];
      onChange?.(selectedUuids);
    },
    [onChange],
  );

  const serviceTypeOptions = useMemo(
    () => serviceTypes?.map((item) => ({ id: item.uuid, label: item.name })) ?? [],
    [serviceTypes],
  );

  const selectedServiceTypes = useMemo(
    () => serviceTypeOptions.filter((serviceType) => appointmentServiceTypes.includes(serviceType.id)),
    [appointmentServiceTypes, serviceTypeOptions],
  );

  return (
    <PageHeader className={styles.header} data-testid="appointments-header">
      <PageHeaderContent illustration={<AppointmentsPictogram />} title={title} />
      <div className={styles.rightJustifiedItems}>
        {typeof onChange === 'function' && (
          <div className={styles.serviceFilter}>
            <MultiSelect
              className={styles.serviceTypeFilter}
              id="serviceTypeMultiSelect"
              items={serviceTypeOptions}
              itemToString={(item) => (item ? item.label : '')}
              label={t('all', 'All')}
              onChange={handleMultiSelectChange}
              selectedItems={selectedServiceTypes}
              titleText={t('service', 'Service')}
              type="inline"
              useTitleInItem
            />
          </div>
        )}
        <OpenmrsDatePicker
          className={styles.dateFilter}
          data-testid="appointment-date-picker"
          id="appointment-date-picker"
          labelText={t('date', 'Date')}
          onChange={(date) => setSelectedDate(dayjs(date).startOf('day').format(omrsDateFormat))}
          value={dayjs(selectedDate).toDate()}
        />
      </div>
    </PageHeader>
  );
};

export default AppointmentsHeader;
