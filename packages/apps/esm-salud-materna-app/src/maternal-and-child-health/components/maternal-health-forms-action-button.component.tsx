import { ActionMenuButton, DocumentIcon } from '@openmrs/esm-framework';
import { useLaunchWorkspaceRequiringVisit } from '@openmrs/esm-patient-common-lib';
import React, { type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

const maternalHealthFormsWorkspace = 'maternal-health-forms-selector-workspace';

const MaternalHealthFormsActionButton: React.FC = () => {
  const { t } = useTranslation();
  const launchMaternalHealthFormsWorkspace = useLaunchWorkspaceRequiringVisit(maternalHealthFormsWorkspace);

  return (
    <ActionMenuButton
      getIcon={(props: ComponentProps<typeof DocumentIcon>) => <DocumentIcon {...props} />}
      label={t('maternalHealthForms', 'Formularios de salud materna')}
      iconDescription={t('maternalHealthForms', 'Formularios de salud materna')}
      handler={launchMaternalHealthFormsWorkspace}
      type="maternal-health-forms"
    />
  );
};

export default MaternalHealthFormsActionButton;
