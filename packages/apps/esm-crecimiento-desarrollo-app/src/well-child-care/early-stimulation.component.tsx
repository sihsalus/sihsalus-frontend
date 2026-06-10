import { Friendship, Growth, UserFollow } from '@carbon/react/icons';
import { usePatient } from '@openmrs/esm-framework';
import type { TabConfig } from '@sihsalus/esm-sihsalus-shared';
import { TabbedDashboard } from '@sihsalus/esm-sihsalus-shared';
import React, { useMemo } from 'react';
import { credEarlyStimulationPrivilege } from '../constants';
import { DashboardAccess } from '../rbac';

const translationNamespace = '@sihsalus/esm-cred-app';

interface EarlyStimulationProps {
  patient?: fhir.Patient | null;
  patientUuid?: string | null;
}

export const EarlyStimulation: React.FC<EarlyStimulationProps> = ({
  patient: patientProp,
  patientUuid: patientUuidProp,
}) => {
  const { patient: hookPatient, patientUuid: hookPatientUuid } = usePatient();
  const patient = patientProp ?? hookPatient;
  const patientUuid = patientUuidProp ?? hookPatientUuid;
  const tabs: TabConfig[] = useMemo(
    () => [
      {
        labelKey: 'stimulationSessions',
        icon: Friendship,
        slotName: 'early-stimulation-sessions-slot',
      },
      {
        labelKey: 'stimulationFollowUp',
        icon: Growth,
        slotName: 'early-stimulation-followup-slot',
      },
      {
        labelKey: 'stimulationCounseling',
        icon: UserFollow,
        slotName: 'early-stimulation-counseling-slot',
      },
    ],
    [],
  );

  if (!patient || !patientUuid) {
    return null;
  }

  return (
    <DashboardAccess privilege={credEarlyStimulationPrivilege}>
      <TabbedDashboard
        patient={patient}
        patientUuid={patientUuid}
        titleKey="earlyStimulation"
        tabs={tabs}
        ariaLabelKey="earlyStimulationTabs"
        translationNamespace={translationNamespace}
      />
    </DashboardAccess>
  );
};
