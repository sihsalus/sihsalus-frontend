import { ActionMenuButton2, PenIcon, UserHasAccess } from '@openmrs/esm-framework';
import {
  type PatientChartWorkspaceActionButtonProps,
  usePatientChartStore,
  useStartVisitIfNeeded,
} from '@openmrs/esm-patient-common-lib';
import React, { type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { visitNotesEditPrivilege } from './constants';

/**
 * This button uses the patient chart store and MUST only be used
 * within the patient chart
 */
const VisitNoteActionButton: React.FC<PatientChartWorkspaceActionButtonProps> = ({ groupProps }) => {
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
    <UserHasAccess privilege={visitNotesEditPrivilege}>
      <ActionMenuButton2
        icon={(props: ComponentProps<typeof PenIcon>) => <PenIcon {...props} />}
        label={t('visitNote', 'Visit note')}
        workspaceToLaunch={{
          workspaceName: 'visit-notes-form-workspace',
          workspaceProps: {},
          groupProps: patientChartGroupProps,
        }}
        onBeforeWorkspaceLaunch={startVisitIfNeeded}
      />
    </UserHasAccess>
  );
};

export default VisitNoteActionButton;
