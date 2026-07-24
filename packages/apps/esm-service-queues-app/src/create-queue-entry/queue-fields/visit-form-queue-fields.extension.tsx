import { InlineNotification } from '@carbon/react';
import { reportError, usePatient, type Visit } from '@openmrs/esm-framework';
import React, { Component, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

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

interface QueueFieldsErrorBoundaryProps {
  children: ReactNode;
  title: string;
  message: string;
}

class QueueFieldsErrorBoundary extends Component<QueueFieldsErrorBoundaryProps, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    reportError(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <InlineNotification
          hideCloseButton
          kind="error"
          lowContrast
          role="alert"
          title={this.props.title}
          subtitle={this.props.message}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * This extension contains form fields for starting a patient's queue entry.
 * It is used slotted into the patient-chart's start visit form
 */
const VisitFormQueueFields: React.FC<VisitFormQueueFieldsProps> = (props) => {
  const { t } = useTranslation();
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
    patientChartConfig?.showServiceQueueFields ||
    visitFormOpenedFrom === 'service-queues-add-patient' ||
    visitFormOpenedFrom === 'appointments-check-in'
  ) {
    return (
      <QueueFieldsErrorBoundary
        title={t('appointmentQueueFieldsLoadError', 'No se pudo cargar la información de la cola')}
        message={t(
          'appointmentQueueFieldsLoadErrorMessage',
          'Cierre este formulario y vuelva a registrar la llegada. Si el problema continúa, contacte a soporte.',
        )}
      >
        <QueueFields
          currentServiceQueueUuid={currentServiceQueueUuid}
          currentQueueLocationUuid={currentQueueLocationUuid}
          patientGender={patient?.gender}
          requestedServiceName={requestedServiceName}
          onQueueEntryAdded={onQueueEntryAdded}
          setCallbacks={(callbacks) => setVisitFormCallbacks({ ...callbacks, kind: 'queue-entry' })}
        />
      </QueueFieldsErrorBoundary>
    );
  } else {
    return <></>;
  }
};

export default VisitFormQueueFields;
