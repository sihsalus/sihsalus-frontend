import { ChartMultitype, Report } from '@carbon/react/icons';
import { BabyIcon, usePatient } from '@openmrs/esm-framework';
import type { TabConfig } from '@openmrs/esm-patient-common-lib';

import { TabbedDashboard } from '@openmrs/esm-patient-common-lib';
import React, { useMemo } from 'react';

const translationNamespace = '@sihsalus/esm-salud-materna-app';

export interface LabourDeliveryProps {
  patient?: fhir.Patient | null;
  patientUuid?: string | null;
}

export const LabourDelivery: React.FC<LabourDeliveryProps> = ({
  patient: patientProp,
  patientUuid: patientUuidProp,
}) => {
  const { patient: hookPatient, patientUuid: hookPatientUuid } = usePatient();
  const patient = patientProp ?? hookPatient;
  const patientUuid = patientUuidProp ?? hookPatientUuid;
  const tabs: TabConfig[] = useMemo(
    () => [
      {
        labelKey: 'summaryOfLaborAndPostpartum',
        icon: Report,
        slotName: 'labour-delivery-summary-slot',
      },
      {
        labelKey: 'deliveryOrAbortion',
        icon: BabyIcon,
        slotName: 'labour-delivery-delivery-abortion-slot',
      },
      {
        labelKey: 'partograph',
        icon: ChartMultitype,
        slotName: 'labour-delivery-partograph-slot',
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
      titleKey="labourAndDelivery"
      tabs={tabs}
      ariaLabelKey="labourAndDeliveryTabs"
      translationNamespace={translationNamespace}
    />
  );
};
