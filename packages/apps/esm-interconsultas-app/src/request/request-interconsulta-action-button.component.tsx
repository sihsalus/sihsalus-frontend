import { OverflowMenuItem } from '@carbon/react';
import { useLaunchWorkspaceRequiringVisit } from '@openmrs/esm-patient-common-lib';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { interconsultasChartEditPrivilege } from '../constants';

interface RequestInterconsultaActionButtonProps {
  closeMenu?: () => void;
}

const RequestInterconsultaActionButton: React.FC<RequestInterconsultaActionButtonProps> = ({ closeMenu }) => {
  const { t } = useTranslation();
  const launchRequestWorkspace = useLaunchWorkspaceRequiringVisit('request-interconsulta-workspace');

  return (
    <RequirePrivilege privilege={interconsultasChartEditPrivilege} hideUnauthorized>
      <OverflowMenuItem
        itemText={t('requestInterconsulta', 'Solicitar interconsulta')}
        onClick={launchRequestWorkspace}
        closeMenu={closeMenu}
      />
    </RequirePrivilege>
  );
};

export default RequestInterconsultaActionButton;
