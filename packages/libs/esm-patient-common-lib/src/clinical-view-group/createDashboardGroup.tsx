import { usePatient } from '@openmrs/esm-framework';
import { memo, useMemo } from 'react';

import { usePatientEnrollment } from './clinical-view-group.resource';
import { DashboardGroupExtension } from './dashboard-group.component';
import { evaluateShowWhenExpression } from './evaluate-show-when-expression';

type DashboardGroupProps = {
  title: string;
  slotName: string;
  isExpanded?: boolean;
  isChild?: boolean;
  showWhenExpression?: string;
  basePath?: string;
};

const DashboardGroup = memo(
  ({ title, slotName, isExpanded, isChild, basePath, showWhenExpression }: DashboardGroupProps) => {
    const { patient, isLoading: isLoadingPatient } = usePatient();
    const { activePatientEnrollment, isLoading: isLoadingActiveEnrollment } = usePatientEnrollment(patient?.id);

    const showGroup = useMemo(
      () => evaluateShowWhenExpression(showWhenExpression, patient, activePatientEnrollment),
      [showWhenExpression, patient, activePatientEnrollment],
    );

    if (isLoadingPatient || isLoadingActiveEnrollment || !showGroup) {
      return null;
    }

    return (
      <DashboardGroupExtension
        key={basePath}
        isChild={isChild}
        title={title}
        slotName={slotName}
        basePath={basePath}
        isExpanded={isExpanded}
      />
    );
  },
);

export const createClinicalDashboardGroup = ({
  title,
  slotName,
  isExpanded,
  isChild,
  showWhenExpression,
}: DashboardGroupProps) => {
  return ({ basePath, ...rest }) => (
    <DashboardGroup
      basePath={basePath}
      title={title}
      slotName={slotName}
      isExpanded={isExpanded}
      isChild={isChild}
      showWhenExpression={showWhenExpression}
      {...rest}
    />
  );
};
