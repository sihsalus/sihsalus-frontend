import { Receipt } from '@carbon/react/icons';
import { ActionMenuButton2 } from '@openmrs/esm-framework';
import { type PatientChartWorkspaceActionButtonProps, usePatientChartStore } from '@openmrs/esm-patient-common-lib';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import React, { type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

import { fuaReadPrivilege } from './constant';

const patientFuasWorkspaceName = 'patient-fuas-workspace';

const FuaEncounterActionContent: React.FC<PatientChartWorkspaceActionButtonProps> = ({ groupProps }) => {
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

  return (
    <ActionMenuButton2
      icon={(props: ComponentProps<typeof Receipt>) => <Receipt {...props} />}
      label={t('viewPatientFuas', 'Ver FUAs del paciente')}
      workspaceToLaunch={{
        workspaceName: patientFuasWorkspaceName,
        workspaceProps: patientUuid ? { patientUuid } : {},
        groupProps: patientChartGroupProps,
      }}
    />
  );
};

const FuaEncounterAction: React.FC<PatientChartWorkspaceActionButtonProps> = (props) => (
  <RequirePrivilege privilege={fuaReadPrivilege} hideUnauthorized>
    <FuaEncounterActionContent {...props} />
  </RequirePrivilege>
);

export default FuaEncounterAction;
