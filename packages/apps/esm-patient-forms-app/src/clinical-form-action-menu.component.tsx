import { ActionMenuButton, DocumentIcon } from '@openmrs/esm-framework';
import { clinicalFormsWorkspace, useLaunchWorkspaceRequiringVisit } from '@openmrs/esm-patient-common-lib';
import React, { type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

const renderDocumentIcon = (props: ComponentProps<typeof DocumentIcon>) =>
  DocumentIcon ? <DocumentIcon {...props} /> : null;

const ClinicalFormActionMenu: React.FC = () => {
  const { t } = useTranslation();
  const launchFormsWorkspace = useLaunchWorkspaceRequiringVisit(clinicalFormsWorkspace);

  return (
    <ActionMenuButton
      getIcon={renderDocumentIcon}
      label={t('clinicalForms', 'Clinical forms')}
      iconDescription={t('clinicalForms', 'Clinical forms')}
      handler={() => launchFormsWorkspace()}
      type="clinical-form"
    />
  );
};

export default ClinicalFormActionMenu;
