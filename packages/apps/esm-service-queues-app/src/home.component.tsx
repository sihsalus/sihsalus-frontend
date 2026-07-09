import { ExtensionSlot } from '@openmrs/esm-framework';
import React from 'react';
import ClinicMetrics from './metrics/metrics-container.component';
import PatientQueueHeader from './patient-queue-header/patient-queue-header.component';
import DefaultQueueTable from './queue-table/default-queue-table.component';

const Home: React.FC = () => {
  return (
    <>
      <PatientQueueHeader showFilters />
      <ExtensionSlot name="service-queues-emergency-header-slot" />
      <ExtensionSlot name="service-queues-emergency-alerts-slot" />
      <ExtensionSlot name="service-queues-emergency-priority-cards-slot" />
      <div data-standard-metrics-container>
        <ClinicMetrics />
      </div>
      <ExtensionSlot name="service-queues-emergency-metrics-slot" />
      <div data-standard-queue-table-container>
        <DefaultQueueTable />
      </div>
      <ExtensionSlot name="service-queues-emergency-queue-table-slot" />
    </>
  );
};

export default Home;
