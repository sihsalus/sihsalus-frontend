import { ActionMenuButton, DocumentIcon } from '@openmrs/esm-framework';
import { useLaunchWorkspaceRequiringVisit } from '@openmrs/esm-patient-common-lib';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import React, { type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { credCourseLifeEditPrivilege } from '../../constants';

interface CREDFormActionButtonProps {
  patientUuid: string;
}

const CREDFormActionButton: React.FC<CREDFormActionButtonProps> = () => {
  const { t } = useTranslation();
  const launchCREDFormsWorkspace = useLaunchWorkspaceRequiringVisit('forms-selector-workspace');

  return (
    <RequirePrivilege privilege={credCourseLifeEditPrivilege} hideUnauthorized>
      <ActionMenuButton
        getIcon={(props: ComponentProps<typeof DocumentIcon>) => <DocumentIcon {...props} />}
        label={t('credForms', 'Formularios Crecimiento y Desarrollo')}
        iconDescription={t('credForms', 'Formularios Crecimiento y Desarrollo')}
        handler={launchCREDFormsWorkspace}
        type={'cred-form'}
      />
    </RequirePrivilege>
  );
};

export default CREDFormActionButton;
