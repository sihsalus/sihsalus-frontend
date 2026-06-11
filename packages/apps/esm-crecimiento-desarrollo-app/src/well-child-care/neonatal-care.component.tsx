import {
  Activity,
  CloudMonitoring,
  HospitalBed,
  Stethoscope,
  UserFollow,
  WatsonHealthCobbAngle,
} from '@carbon/react/icons';
import { usePatient } from '@openmrs/esm-framework';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import type { TabConfig } from '@sihsalus/esm-sihsalus-shared';
import { TabbedDashboard } from '@sihsalus/esm-sihsalus-shared';
import React, { useMemo } from 'react';
import { credNeonatalPrivilege } from '../constants';

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
        labelKey: 'newbornVitals',
        icon: Activity,
        slotName: 'neonatal-vitals-slot',
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
        labelKey: 'breastfeedingCounseling',
        icon: WatsonHealthCobbAngle,
        slotName: 'neonatal-counseling-slot',
      },
    ],
    [],
  );

  if (!patient || !patientUuid) {
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
      />
    </RequirePrivilege>
  );
};
