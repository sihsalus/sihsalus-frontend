import { Receipt } from '@carbon/react/icons';
import { ActionMenuButton2 } from '@openmrs/esm-framework';
import {
  type PatientChartWorkspaceActionButtonProps,
  usePatientChartStore,
  useStartVisitIfNeeded,
} from '@openmrs/esm-patient-common-lib';
import React, { type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

const FuaEncounterAction: React.FC<PatientChartWorkspaceActionButtonProps> = ({ groupProps }) => {
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
      icon={(props: ComponentProps<typeof Receipt>) => <Receipt {...props} />}
      label={t('createFua', 'Crear FUA')}
      workspaceToLaunch={{
        workspaceName: 'fua-encounter-workspace',
        groupProps: patientChartGroupProps,
      }}
      onBeforeWorkspaceLaunch={startVisitIfNeeded}
    />
  );
};

export default FuaEncounterAction;
