import { ChartLineData, Stethoscope, UserFollow } from '@carbon/react/icons';
import { usePatient } from '@openmrs/esm-framework';
import type { TabConfig } from '@sihsalus/esm-sihsalus-shared';
import { TabbedDashboard } from '@sihsalus/esm-sihsalus-shared';
import React, { useMemo } from 'react';
import { credNutritionPrivilege } from '../constants';
import { DashboardAccess } from '../rbac';

const translationNamespace = '@sihsalus/esm-cred-app';

interface ChildNutritionProps {
  patient?: fhir.Patient | null;
  patientUuid?: string | null;
}

export const ChildNutrition: React.FC<ChildNutritionProps> = ({
  patient: patientProp,
  patientUuid: patientUuidProp,
}) => {
  const { patient: hookPatient, patientUuid: hookPatientUuid } = usePatient();
  const patient = patientProp ?? hookPatient;
  const patientUuid = patientUuidProp ?? hookPatientUuid;
  const tabs: TabConfig[] = useMemo(
    () => [
      {
        labelKey: 'nutritionalAssessment',
        icon: Stethoscope,
        slotName: 'child-nutrition-assessment-slot',
      },
      {
        labelKey: 'feedingCounseling',
        icon: UserFollow,
        slotName: 'child-nutrition-counseling-slot',
      },
      {
        labelKey: 'nutritionFollowUp',
        icon: ChartLineData,
        slotName: 'child-nutrition-followup-slot',
      },
    ],
    [],
  );

  if (!patient || !patientUuid) {
    return null;
  }

  return (
    <DashboardAccess privilege={credNutritionPrivilege}>
      <TabbedDashboard
        patient={patient}
        patientUuid={patientUuid}
        titleKey="childNutrition"
        tabs={tabs}
        ariaLabelKey="childNutritionTabs"
        translationNamespace={translationNamespace}
      />
    </DashboardAccess>
  );
};
