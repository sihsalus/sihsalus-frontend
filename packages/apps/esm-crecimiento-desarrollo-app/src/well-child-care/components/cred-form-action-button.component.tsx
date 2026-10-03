import { ActionMenuButton2, DocumentIcon, UserHasAccess } from '@openmrs/esm-framework';
import {
  type PatientChartWorkspaceActionButtonProps,
  usePatientChartStore,
  useStartVisitIfNeeded,
} from '@openmrs/esm-patient-common-lib';
import React, { type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { credCourseLifeEditPrivilege } from '../../constants';

const CREDFormActionButton: React.FC<PatientChartWorkspaceActionButtonProps> = ({ groupProps }) => {
  const { t } = useTranslation('@sihsalus/esm-cred-app');
  const chart = usePatientChartStore();
  const patientUuid = groupProps?.patientUuid ?? chart.patientUuid;
  const patientChartGroupProps =
    groupProps ??
    (patientUuid
      ? {
          patient: chart.patient,
          patientUuid,
          visitContext: chart.visitContext,
          mutateVisitContext: chart.mutateVisitContext,
        }
      : null);
  const startVisitIfNeeded = useStartVisitIfNeeded(patientUuid ?? undefined);

  if (!patientUuid) return null;

  return (
    <UserHasAccess privilege={credCourseLifeEditPrivilege}>
      <ActionMenuButton2
        icon={(props: ComponentProps<typeof DocumentIcon>) => <DocumentIcon {...props} />}
        label={t('credForms', 'Formularios Crecimiento y Desarrollo')}
        workspaceToLaunch={{
          workspaceName: 'wellchild-control-form',
          workspaceProps: { patientUuid },
          groupProps: patientChartGroupProps,
        }}
        onBeforeWorkspaceLaunch={startVisitIfNeeded}
      />
    </UserHasAccess>
  );
};

export default CREDFormActionButton;
