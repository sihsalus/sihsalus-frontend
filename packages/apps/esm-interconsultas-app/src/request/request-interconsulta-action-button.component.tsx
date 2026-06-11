import { ActionMenuButton, ReferralOrderIcon } from '@openmrs/esm-framework';
import { useLaunchWorkspaceRequiringVisit } from '@openmrs/esm-patient-common-lib';
import React, { type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

const RequestInterconsultaActionButton: React.FC = () => {
  const { t } = useTranslation();
  const launchRequestWorkspace = useLaunchWorkspaceRequiringVisit('request-interconsulta-workspace');

  return (
    <ActionMenuButton
      getIcon={(props: ComponentProps<typeof ReferralOrderIcon>) => <ReferralOrderIcon {...props} />}
      label={t('requestInterconsulta', 'Solicitar interconsulta')}
      iconDescription={t('requestInterconsulta', 'Solicitar interconsulta')}
      handler={launchRequestWorkspace}
      type="request-interconsulta"
    />
  );
};

export default RequestInterconsultaActionButton;
