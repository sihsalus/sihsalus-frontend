import {
  Activity,
  ChartLineData,
  CloudMonitoring,
  HospitalBed,
  Stethoscope,
  UserFollow,
  WatsonHealthCobbAngle,
} from '@carbon/react/icons';
import { usePatient } from '@openmrs/esm-framework';
import type { TabConfig } from '@openmrs/esm-patient-common-lib';
import { TabbedDashboard } from '@openmrs/esm-patient-common-lib';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import React, { useMemo } from 'react';
import { credNeonatalPrivilege, neonatalFluidBalanceSlot } from '../constants';

export interface NeonatalCareProps {
  patient?: fhir.Patient | null;
  patientUuid?: string | null;
}

export const NeonatalCare: React.FC<NeonatalCareProps> = ({ patient: patientProp, patientUuid: patientUuidProp }) => {
  const { patient: hookPatient, patientUuid: hookPatientUuid } = usePatient();
  const patient = patientProp ?? hookPatient;
  const patientUuid = patientUuidProp ?? hookPatientUuid;
  const translationNamespace = '@sihsalus/esm-cred-app';
  const tabs: TabConfig[] = useMemo(
    () => [
      {
        id: 'vitals',
        labelKey: 'newbornVitals',
        icon: Activity,
        slotName: 'neonatal-vitals-slot',
      },
      {
        id: 'fluid-balance',
        labelKey: 'fluidBalance',
        icon: ChartLineData,
        slotName: neonatalFluidBalanceSlot,
      },
      {
        labelKey: 'perinatalRecord',
        icon: UserFollow,
        slotName: 'neonatal-perinatal-slot',
      },
      {
        labelKey: 'immediateAttention',
        icon: CloudMonitoring,
        slotName: 'neonatal-attention-slot',
      },
      {
        labelKey: 'cephalocaudalEvaluation',
        icon: Stethoscope,
        slotName: 'neonatal-evaluation-slot',
      },
      {
        labelKey: 'alojamientoConjunto',
        icon: HospitalBed,
        slotName: 'neonatal-alojamiento-conjunto-slot',
      },
      {
        labelKey: 'breastfeedingTab',
        icon: WatsonHealthCobbAngle,
        slotName: 'neonatal-counseling-slot',
      },
    ],
    [],
  );

  if (!patient || !patientUuid || patient.id !== patientUuid) {
    return null;
  }

  return (
    <RequirePrivilege privilege={credNeonatalPrivilege}>
      <TabbedDashboard
        patient={patient}
        patientUuid={patientUuid}
        titleKey="neonatalCare"
        tabs={tabs}
        ariaLabelKey="neonatalCareTabs"
        translationNamespace={translationNamespace}
        mountActiveTabOnly
      />
    </RequirePrivilege>
  );
};
