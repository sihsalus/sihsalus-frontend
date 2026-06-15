import { formatDate, parseDate } from '@openmrs/esm-framework';
import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import SelectedDateContext from '../../hooks/selectedDateContext';
import { useClinicalMetrics } from '../../hooks/useClinicalMetrics';
import MetricsCard from '../metrics-card.component';

export default function HighestVolumeServiceExtension() {
  const { t } = useTranslation();
  const { selectedDate } = useContext(SelectedDateContext);
  const { highestServiceLoad, error } = useClinicalMetrics();
  const formattedStartDate = formatDate(parseDate(selectedDate), { mode: 'standard', time: false });

  if (error) {
    return (
      <MetricsCard
        headerLabel={t('highestServiceVolumeCardTitle', 'Highest volume service')}
        label={t('serviceName', 'Service name')}
        value={'--'}
      />
    );
  }

  return (
    <MetricsCard
      headerLabel={t('highestServiceVolume', 'Highest volume service: {{time}}', { time: formattedStartDate })}
      label={highestServiceLoad ? t(highestServiceLoad.serviceName) : t('serviceName', 'Service name')}
      value={highestServiceLoad?.count ?? '--'}
    />
  );
}
