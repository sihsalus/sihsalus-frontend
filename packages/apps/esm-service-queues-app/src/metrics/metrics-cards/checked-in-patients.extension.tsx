import { useTranslation } from 'react-i18next';
import { useActiveVisits } from '../metrics.resource';
import { MetricsCard, MetricsCardBody, MetricsCardHeader, MetricsCardItem } from './metrics-card.component';

export default function CheckedInPatientsExtension() {
  const { t } = useTranslation();
  const { isLoading, activeVisitsCount } = useActiveVisits();

  return (
    <MetricsCard>
      <MetricsCardHeader title={t('checkedInPatients', 'Checked in patients')} />
      <MetricsCardBody>
        <MetricsCardItem label={t('patients', 'Patients')} value={isLoading ? '--' : activeVisitsCount} />
      </MetricsCardBody>
    </MetricsCard>
  );
}
