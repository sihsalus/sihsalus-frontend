import { ActionMenuButton, DocumentIcon } from '@openmrs/esm-framework';
import { useLaunchWorkspaceRequiringVisit } from '@openmrs/esm-patient-common-lib';
import React, { type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

const MaternalHealthFormsActionButton: React.FC = () => {
  const { t } = useTranslation();
  const launchFormsWorkspace = useLaunchWorkspaceRequiringVisit('maternal-health-forms-selector-workspace');

  return (
    <ActionMenuButton
      getIcon={(props: ComponentProps<typeof DocumentIcon>) => <DocumentIcon {...props} />}
      label={t('maternalHealthForms', 'Formularios de salud materna')}
      iconDescription={t('maternalHealthForms', 'Formularios de salud materna')}
      handler={launchFormsWorkspace}
      type="maternal-health-form"
    />
  );
};

export default MaternalHealthFormsActionButton;
