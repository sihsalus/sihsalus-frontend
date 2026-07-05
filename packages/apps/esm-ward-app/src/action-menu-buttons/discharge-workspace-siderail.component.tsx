import { Exit } from '@carbon/react/icons';
import { ActionMenuButton2, useConfig, useSession, userHasAccess } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import { wardEditPrivilege } from '../constant';
import { type DischargeWorkspaceSiderailConfig } from './discharge-workspace-siderail-config-schema';

export default function PatientDischargeSideRailIcon() {
  const { t } = useTranslation();
  const { sessionLocation, user } = useSession();
  const { allowedSessionLocationUuids } = useConfig<DischargeWorkspaceSiderailConfig>();

  if (!userHasAccess(wardEditPrivilege, user)) {
    return null;
  }

  if (allowedSessionLocationUuids.length > 0 && !allowedSessionLocationUuids.includes(sessionLocation?.uuid)) {
    return null;
  }

  return (
    <ActionMenuButton2
      icon={(props) => <Exit {...props} />}
      label={t('discharge', 'Discharge')}
      workspaceToLaunch={{
        workspaceName: 'patient-discharge-workspace',
      }}
    />
  );
}
