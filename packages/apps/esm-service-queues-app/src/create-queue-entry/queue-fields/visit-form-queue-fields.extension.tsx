import { usePatient, type Visit } from '@openmrs/esm-framework';
import React from 'react';

import QueueFields from './queue-fields.component';

interface VisitFormCallbacks {
  kind: 'queue-entry';
  onBeforeVisitSave: () => boolean;
  onVisitCreatedOrUpdated: (visit: Visit) => Promise<unknown>;
}
// See VisitFormExtensionState in esm-patient-chart-app
export interface VisitFormQueueFieldsProps {
  setVisitFormCallbacks: (callbacks: VisitFormCallbacks) => void;
  visitFormOpenedFrom: string;
  patientChartConfig?: {
    showServiceQueueFields: boolean;
  };
  patientUuid: string;
  currentServiceQueueUuid?: string;
  currentQueueLocationUuid?: string;
  requestedServiceName?: string;
  onQueueEntryAdded?: () => void | Promise<void>;
}

/**
 * This extension contains form fields for starting a patient's queue entry.
 * It is used slotted into the patient-chart's start visit form
 */
const VisitFormQueueFields: React.FC<VisitFormQueueFieldsProps> = (props) => {
  const {
    setVisitFormCallbacks,
    visitFormOpenedFrom,
    patientChartConfig,
    currentServiceQueueUuid,
    currentQueueLocationUuid,
    patientUuid,
    requestedServiceName,
    onQueueEntryAdded,
  } = props;
  const { patient } = usePatient(patientUuid);
  if (
    patientChartConfig.showServiceQueueFields ||
    visitFormOpenedFrom === 'service-queues-add-patient' ||
    visitFormOpenedFrom === 'appointments-check-in'
  ) {
    return (
      <QueueFields
        currentServiceQueueUuid={currentServiceQueueUuid}
        currentQueueLocationUuid={currentQueueLocationUuid}
        patientGender={patient?.gender}
        requestedServiceName={requestedServiceName}
        onQueueEntryAdded={onQueueEntryAdded}
        setCallbacks={(callbacks) => setVisitFormCallbacks({ ...callbacks, kind: 'queue-entry' })}
      />
    );
  } else {
    return <></>;
  }
};

export default VisitFormQueueFields;
