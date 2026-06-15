import { ChartLineData, Stethoscope, WatsonHealthCobbAngle } from '@carbon/react/icons';
import { usePatient } from '@openmrs/esm-framework';
import type { TabConfig } from '@openmrs/esm-patient-common-lib';

import { TabbedDashboard } from '@openmrs/esm-patient-common-lib';
import React, { useMemo } from 'react';

export interface CancerPreventionProps {
  patient?: fhir.Patient | null;
  patientUuid?: string | null;
}

export const CancerPrevention: React.FC<CancerPreventionProps> = ({
  patient: patientProp,
  patientUuid: patientUuidProp,
}) => {
  const { patient: hookPatient, patientUuid: hookPatientUuid } = usePatient();
  const patient = patientProp ?? hookPatient;
  const patientUuid = patientUuidProp ?? hookPatientUuid;
  const tabs: TabConfig[] = useMemo(
    () => [
      {
        labelKey: 'cervicalCancer',
        icon: WatsonHealthCobbAngle,
        slotName: 'cancer-prevention-cervical-slot',
      },
      {
        labelKey: 'breastCancer',
        icon: Stethoscope,
        slotName: 'cancer-prevention-breast-slot',
      },
      {
        labelKey: 'cancerFollowUp',
        icon: ChartLineData,
        slotName: 'cancer-prevention-followup-slot',
      },
    ],
    [],
  );

  if (!patient || !patientUuid) {
    return null;
  }

  return (
    <TabbedDashboard
      patient={patient}
      patientUuid={patientUuid}
      titleKey="cancerPrevention"
      tabs={tabs}
      ariaLabelKey="cancerPreventionTabs"
    />
  );
};
