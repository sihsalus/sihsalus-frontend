import { ExtensionSlot } from '@openmrs/esm-framework';
import React from 'react';
import ClinicMetrics from './metrics/metrics-container.component';
import MetricsHeader from './metrics/metrics-header.component';
import PatientQueueHeader from './patient-queue-header/patient-queue-header.component';
import DefaultQueueTable from './queue-table/default-queue-table.component';
import { useServiceQueuesStore } from './store/store';

const Home: React.FC = () => {
  // The emergency app claims the UI through the shared store while its
  // extensions replace the standard metrics/table for emergency locations.
  const { emergencyUiActive } = useServiceQueuesStore();

  return (
    <>
      <PatientQueueHeader showFilters />
      <ExtensionSlot name="service-queues-emergency-header-slot" />
      <ExtensionSlot name="service-queues-emergency-alerts-slot" />
      <ExtensionSlot name="service-queues-emergency-priority-cards-slot" />
      {!emergencyUiActive && (
        <div>
          <MetricsHeader />
          <ClinicMetrics />
        </div>
      )}
      <ExtensionSlot name="service-queues-emergency-metrics-slot" />
      {!emergencyUiActive && (
        <div>
          <DefaultQueueTable />
        </div>
      )}
      <ExtensionSlot name="service-queues-emergency-queue-table-slot" />
    </>
  );
};

export default Home;
