import { Activity, Stethoscope } from '@carbon/react/icons';
import { usePatient } from '@openmrs/esm-framework';
import type { TabConfig } from '@openmrs/esm-patient-common-lib';

import { TabbedDashboard } from '@openmrs/esm-patient-common-lib';
import React, { useMemo } from 'react';

const translationNamespace = '@sihsalus/esm-salud-materna-app';

export interface PostnatalCareProps {
  patient?: fhir.Patient | null;
  patientUuid?: string | null;
}

export const PostnatalCare: React.FC<PostnatalCareProps> = ({ patient: patientProp, patientUuid: patientUuidProp }) => {
  const { patient: hookPatient, patientUuid: hookPatientUuid } = usePatient();
  const patient = patientProp ?? hookPatient;
  const patientUuid = patientUuidProp ?? hookPatientUuid;
  const tabs: TabConfig[] = useMemo(
    () => [
      {
        labelKey: 'immediatePostpartum',
        icon: Activity,
        slotName: 'postnatal-care-immediate-slot',
      },
      {
        labelKey: 'postnatalControls',
        icon: Stethoscope,
        slotName: 'postnatal-care-controls-slot',
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
      titleKey="postnatalCare"
      tabs={tabs}
      ariaLabelKey="postnatalCareTabs"
      translationNamespace={translationNamespace}
    />
  );
};
