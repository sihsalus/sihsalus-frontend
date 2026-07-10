import { ActionMenuButton, DocumentIcon } from '@openmrs/esm-framework';
import { useLaunchWorkspaceRequiringVisit } from '@openmrs/esm-patient-common-lib';
import React, { type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { useCREDSchedule } from '../../hooks/useCREDSchedule';

interface CREDFormActionButtonProps {
  patientUuid: string;
}

const CREDFormActionButton: React.FC<CREDFormActionButtonProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const { nextDueControl } = useCREDSchedule(patientUuid);
  const launchCREDFormsWorkspace = useLaunchWorkspaceRequiringVisit<{
    control: typeof nextDueControl;
    workspaceTitle: string;
  }>(patientUuid, 'wellchild-control-form');

  return (
    <ActionMenuButton
      getIcon={(props: ComponentProps<typeof DocumentIcon>) => <DocumentIcon {...props} />}
      label={t('credForms', 'Formularios Crecimiento y Desarrollo')}
      iconDescription={t('credForms', 'Formularios Crecimiento y Desarrollo')}
      handler={() =>
        launchCREDFormsWorkspace({
          control: nextDueControl,
          workspaceTitle: t('newCredEncounter', 'Nuevo Control Crecimiento y Desarrollo'),
        })
      }
      type={'cred-form'}
    />
  );
};

export default CREDFormActionButton;
