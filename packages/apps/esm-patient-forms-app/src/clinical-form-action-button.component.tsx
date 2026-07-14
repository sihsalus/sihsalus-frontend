import { ActionMenuButton2, DocumentIcon, UserHasAccess } from '@openmrs/esm-framework';
import { type PatientChartWorkspaceActionButtonProps, usePatientChartStore } from '@openmrs/esm-patient-common-lib';
import React, { type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

const renderDocumentIcon = (props: ComponentProps<typeof DocumentIcon>) =>
  DocumentIcon ? <DocumentIcon {...props} /> : null;

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
  return (
    <UserHasAccess privilege="app:hoja.clinica.formulariosClinicos">
      <ActionMenuButton2
        icon={renderDocumentIcon}
        label={t('clinicalForms', 'Clinical forms')}
        workspaceToLaunch={{
          workspaceName: 'clinical-forms-workspace',
          workspaceProps: {},
          groupProps: patientChartGroupProps,
        }}
      />
    </UserHasAccess>
  );
};

export default ClinicalFormActionButton;
