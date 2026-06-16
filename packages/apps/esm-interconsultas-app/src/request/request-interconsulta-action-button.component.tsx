import { OverflowMenuItem } from '@carbon/react';
import { useLaunchWorkspaceRequiringVisit } from '@openmrs/esm-patient-common-lib';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface RequestInterconsultaActionButtonProps {
  closeMenu?: () => void;
}

const RequestInterconsultaActionButton: React.FC<RequestInterconsultaActionButtonProps> = ({ closeMenu }) => {
  const { t } = useTranslation();
  const launchRequestWorkspace = useLaunchWorkspaceRequiringVisit('request-interconsulta-workspace');

  return (
    <OverflowMenuItem
      itemText={t('requestInterconsulta', 'Solicitar interconsulta')}
      onClick={launchRequestWorkspace}
      closeMenu={closeMenu}
    />
  );
};

export default RequestInterconsultaActionButton;
