import { ActionMenuButton2, DocumentIcon } from '@openmrs/esm-framework';
import {
  type PatientChartWorkspaceActionButtonProps,
  usePatientChartStore,
  useStartVisitIfNeeded,
} from '@openmrs/esm-patient-common-lib';
import React, { type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

const ClinicalFormActionButton: React.FC<PatientChartWorkspaceActionButtonProps> = ({ groupProps }) => {
  const { t } = useTranslation();
  const patientChartContext = usePatientChartStore();
  const patientUuid = groupProps?.patientUuid ?? patientChartContext.patientUuid;
  const patientChartGroupProps =
    groupProps ??
    (patientUuid
      ? {
          patient: patientChartContext.patient,
          patientUuid,
          visitContext: patientChartContext.visitContext,
          mutateVisitContext: patientChartContext.mutateVisitContext,
        }
      : null);
  const startVisitIfNeeded = useStartVisitIfNeeded(patientUuid ?? undefined);

  return (
    <ActionMenuButton2
      icon={(props: ComponentProps<typeof DocumentIcon>) => <DocumentIcon {...props} />}
      label={t('clinicalForms', 'Clinical forms')}
      workspaceToLaunch={{
        workspaceName: 'clinical-forms-workspace',
        workspaceProps: {},
        groupProps: patientChartGroupProps,
      }}
      onBeforeWorkspaceLaunch={startVisitIfNeeded}
    />
  );
};

export default ClinicalFormActionButton;
