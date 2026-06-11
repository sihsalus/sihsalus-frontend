import { Calendar, Friendship, Growth, ReminderMedical } from '@carbon/react/icons';
import { usePatient } from '@openmrs/esm-framework';
import type { TabConfig } from '@openmrs/esm-patient-common-lib';
import { TabbedDashboard } from '@openmrs/esm-patient-common-lib';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import React, { useMemo } from 'react';
import { credWellChildPrivilege } from '../constants';

const translationNamespace = '@sihsalus/esm-cred-app';

interface WellChildControlProps {
  patient?: fhir.Patient | null;
  patientUuid?: string | null;
}

export const WellChildControl: React.FC<WellChildControlProps> = ({
  patient: patientProp,
  patientUuid: patientUuidProp,
}) => {
  const { patient: hookPatient, patientUuid: hookPatientUuid } = usePatient();
  const patient = patientProp ?? hookPatient;
  const patientUuid = patientUuidProp ?? hookPatientUuid;
  const tabs: TabConfig[] = useMemo(
    () => [
      {
        labelKey: 'following',
        icon: Friendship,
        slotName: 'cred-following-slot',
      },
      {
        labelKey: 'credControls',
        icon: Calendar,
        slotName: 'cred-schedule-slot',
      },
      {
        labelKey: 'desarrollo',
        icon: Growth,
        slotName: 'cred-development-slot',
      },
      {
        labelKey: 'additionalServices',
        icon: ReminderMedical,
        slotName: 'additional-health-services-slot',
      },
    ],
    [],
  );

  if (!patient || !patientUuid) {
    return null;
  }

  return (
    <RequirePrivilege privilege={credWellChildPrivilege}>
      <TabbedDashboard
        patient={patient}
        patientUuid={patientUuid}
        titleKey="wellChildCare"
        tabs={tabs}
        ariaLabelKey="wellChildCareTabs"
        translationNamespace={translationNamespace}
      />
    </RequirePrivilege>
  );
};
