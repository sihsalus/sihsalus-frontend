import { formatDate, parseDate } from '@openmrs/esm-framework';
import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import SelectedDateContext from '../../hooks/selectedDateContext';
import { useAllAppointmentsByDate } from '../../hooks/useClinicalMetrics';
import MetricsCard from '../metrics-card.component';

export default function ProvidersBookedExtension() {
  const { t } = useTranslation();
  const { selectedDate } = useContext(SelectedDateContext);
  const { totalProviders } = useAllAppointmentsByDate();
  const formattedStartDate = formatDate(parseDate(selectedDate), { mode: 'standard', time: false });

  return (
    <MetricsCard
      headerLabel={t('providersBooked', 'Providers booked: {{time}}', { time: formattedStartDate })}
      label={t('providers', 'Providers')}
      value={totalProviders}
    />
  );
}
