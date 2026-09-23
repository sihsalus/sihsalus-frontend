import { ExtensionSlot, useAssignedExtensions } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import ConditionsDetailedSummary from './conditions-detailed-summary.component';

// Optional composition supplied by Consulta Externa. Keep conditions available
// in installations that do not include that module.
const antecedentsDashboardSlot = 'patient-chart-antecedents-slot';

export default function ConditionsDashboard({ patient }: { patient: fhir.Patient }) {
  const extensions = useAssignedExtensions(antecedentsDashboardSlot);
  const state = useMemo(() => ({ patient, patientUuid: patient.id }), [patient]);

  return extensions.length ? (
    <ExtensionSlot name={antecedentsDashboardSlot} state={state} />
  ) : (
    <ConditionsDetailedSummary patient={patient} />
  );
}
