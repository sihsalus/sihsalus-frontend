import { ChartLineData, Task, UserFollow } from '@carbon/react/icons';
import { usePatient } from '@openmrs/esm-framework';
import type { TabConfig } from '@openmrs/esm-patient-common-lib';

import { TabbedDashboard } from '@openmrs/esm-patient-common-lib';
import React, { useMemo } from 'react';
import MaternalNtsCompliance from './components/maternal-nts-compliance.component';

const translationNamespace = '@sihsalus/esm-salud-materna-app';

export interface PrenatalCareProps {
  patient?: fhir.Patient | null;
  patientUuid?: string | null;
}

export const PrenatalCare: React.FC<PrenatalCareProps> = ({ patient: patientProp, patientUuid: patientUuidProp }) => {
  const { patient: hookPatient, patientUuid: hookPatientUuid } = usePatient();
  const patient = patientProp ?? hookPatient;
  const patientUuid = patientUuidProp ?? hookPatientUuid;
  const tabs: TabConfig[] = useMemo(
    () => [
      {
        labelKey: 'maternalHistory',
        icon: UserFollow,
        slotName: 'prenatal-maternal-history-slot',
      },
      {
        labelKey: 'currentPregnancy',
        icon: Task,
        slotName: 'prenatal-current-pregnancy-slot',
      },
      {
        labelKey: 'prenatalAttention',
        icon: ChartLineData,
        slotName: 'prenatal-care-chart-slot',
      },
    ],
    [],
  );

  if (!patient || !patientUuid) {
    return null;
  }

  return (
    <>
      <MaternalNtsCompliance patientUuid={patientUuid} />
      <TabbedDashboard
        patient={patient}
        patientUuid={patientUuid}
        titleKey="prenatalCare"
        tabs={tabs}
        ariaLabelKey="prenatalCareTabs"
        translationNamespace={translationNamespace}
      />
    </>
  );
};
