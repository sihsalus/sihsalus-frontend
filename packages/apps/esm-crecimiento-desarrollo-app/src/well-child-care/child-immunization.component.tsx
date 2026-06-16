import { Eyedropper, Pills } from '@carbon/react/icons';
import { usePatient } from '@openmrs/esm-framework';
import type { TabConfig } from '@openmrs/esm-patient-common-lib';
import { TabbedDashboard } from '@openmrs/esm-patient-common-lib';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import React, { useMemo } from 'react';
import { credImmunizationPrivilege } from '../constants';

const translationNamespace = '@sihsalus/esm-cred-app';

export interface ChildImmunizationProps {
  patient?: fhir.Patient | null;
  patientUuid?: string | null;
}

export const ChildImmunizationSchedule: React.FC<ChildImmunizationProps> = ({
  patient: patientProp,
  patientUuid: patientUuidProp,
}) => {
  const { patient: hookPatient, patientUuid: hookPatientUuid } = usePatient();
  const patient = patientProp ?? hookPatient;
  const patientUuid = patientUuidProp ?? hookPatientUuid;
  const tabs: TabConfig[] = useMemo(
    () => [
      {
        labelKey: 'vaccinationSchedule',
        icon: Eyedropper,
        slotName: 'vaccination-schedule-slot',
      },
      {
        labelKey: 'adverseReactions',
        icon: Pills,
        slotName: 'vaccination-appointment-slot',
      },
    ],
    [],
  );

  if (!patient || !patientUuid) {
    return null;
  }

  return (
    <RequirePrivilege privilege={credImmunizationPrivilege}>
      <TabbedDashboard
        patient={patient}
        patientUuid={patientUuid}
        titleKey="childImmunizationSchedule"
        tabs={tabs}
        ariaLabelKey="immunizationTabs"
        translationNamespace={translationNamespace}
      />
    </RequirePrivilege>
  );
};
