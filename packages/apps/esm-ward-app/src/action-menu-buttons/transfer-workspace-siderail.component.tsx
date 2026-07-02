import { ActionMenuButton2, MovementIcon, useSession, userHasAccess } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import { wardEditPrivilege } from '../constant';

export default function PatientTransferAndSwapSiderailIcon() {
  const { t } = useTranslation();
  const session = useSession();

  if (!userHasAccess(wardEditPrivilege, session?.user)) {
    return null;
  }

  return (
    <ActionMenuButton2
      icon={(props) => <MovementIcon {...props} />}
      label={t('transfers', 'Transfers')}
      workspaceToLaunch={{
        workspaceName: 'ward-patient-transfer-swap-workspace',
      }}
    />
  );
}
