import { Dropdown } from '@carbon/react';
import { isDesktop, useConfig, useLayoutType } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';

import { type ConfigObject } from '../config-schema';
import { useQueueEntries } from '../hooks/useQueueEntries';
import useQueueServices from '../hooks/useQueueService';
import { updateSelectedService, useServiceQueuesStore } from '../store/store';
import { type Concept } from '../types';

import { useActiveVisits, useAverageWaitTime } from './clinic-metrics.resource';
import styles from './clinic-metrics.scss';
import MetricsCard from './metrics-card.component';
import MetricsHeader from './metrics-header.component';
import { useServiceMetricsCount } from './queue-metrics.resource';

export interface Service {
  display: string;
  uuid?: string;
}

type ServiceListItem = Service | Concept;

function ClinicMetrics() {
  const { t } = useTranslation();
  const layout = useLayoutType();
  const { selectedQueueLocationUuid, selectedServiceDisplay, selectedServiceUuid } = useServiceQueuesStore();
  const {
    concepts: { defaultStatusConceptUuid },
  } = useConfig<ConfigObject>();

  const { services } = useQueueServices();
  const { serviceCount } = useServiceMetricsCount(selectedServiceUuid, selectedQueueLocationUuid);
  const isAllServicesSelected = !selectedServiceUuid;

  const { totalCount } = useQueueEntries({
    service: selectedServiceUuid,
    location: selectedQueueLocationUuid,
    isEnded: false,
  });

  const { activeVisitsCount, isLoading: loading } = useActiveVisits(selectedQueueLocationUuid);
  const { waitTime } = useAverageWaitTime(selectedServiceUuid, defaultStatusConceptUuid);

  const defaultServiceItem: Service = {
    display: `${t('all', 'All')}`,
  };

  const serviceItems: ServiceListItem[] = [defaultServiceItem, ...(services ?? [])];
  const selectedService = services?.find((service) => service.uuid === selectedServiceUuid);

  const handleServiceChange = ({ selectedItem }) => {
    updateSelectedService(selectedItem?.uuid, selectedItem?.display ?? t('all', 'All'));
  };

  return (
    <>
      <MetricsHeader />
      <div className={styles.cardContainer} data-testid="clinic-metrics">
        <MetricsCard
          headerLabel={t('checkedInPatients', 'Checked in patients')}
          label={t('patients', 'Patients')}
          service="scheduled"
          value={loading ? '--' : activeVisitsCount}
        />
        <MetricsCard
          headerLabel=""
          label={t('patients', 'Patients')}
          locationUuid={selectedQueueLocationUuid}
          service={selectedServiceDisplay}
          serviceUuid={selectedServiceUuid}
          value={isAllServicesSelected ? (totalCount ?? '--') : serviceCount}
        >
          <Dropdown
            id="inline"
            initialSelectedItem={defaultServiceItem}
            items={serviceItems}
            itemToString={(item) =>
              item ? `${item.display} ${item.location?.display ? `- ${item.location.display}` : ''}` : ''
            }
            label=""
            onChange={handleServiceChange}
            selectedItem={selectedService ?? defaultServiceItem}
            size={isDesktop(layout) ? 'sm' : 'lg'}
            titleText={`${t('waitingFor', 'Waiting for')}:`}
            type="inline"
          />
        </MetricsCard>
        <MetricsCard
          label={t('minutes', 'Minutes')}
          headerLabel={t('averageWaitTime', 'Average wait time today')}
          service="waitTime"
          value={waitTime ? waitTime.averageWaitTime : '--'}
        />
      </div>
    </>
  );
}

export default ClinicMetrics;
