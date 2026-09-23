import { InlineNotification } from '@carbon/react';
import { useConfig, useLeftNav } from '@openmrs/esm-framework';
import { AppErrorBoundary, RequirePrivilege } from '@sihsalus/esm-rbac';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { mockBloodBankApi, openmrsBloodBankApi } from './api';
import { bloodBankPrivileges } from './access/blood-bank-privileges';
import { BloodBankApp } from './blood-bank-app.component';
import type { BloodBankConfig } from './config-schema';
import { appName, basePath, moduleName } from './constants';

function BloodBankContent({ config }: { config: BloodBankConfig }) {
  const modulePath = `${globalThis.getOpenmrsSpaBase().slice(0, -1)}${basePath}`;
  const leftNav = useMemo(() => ({ name: 'blood-bank-nav-slot', basePath: modulePath }), [modulePath]);
  useLeftNav(leftNav);

  return (
    <BloodBankApp
      api={config.useMockData ? mockBloodBankApi : openmrsBloodBankApi}
      basename={modulePath}
      router="browser"
    />
  );
}

export default function Root() {
  const config = useConfig<BloodBankConfig>();
  const { t } = useTranslation(moduleName);

  return (
    <AppErrorBoundary appName={appName}>
      <RequirePrivilege privilege={bloodBankPrivileges.module}>
        {config.enabled ? (
          <BloodBankContent config={config} />
        ) : (
          <InlineNotification
            hideCloseButton
            kind="info"
            title={t('moduleDisabled', 'Banco de Sangre deshabilitado')}
          />
        )}
      </RequirePrivilege>
    </AppErrorBoundary>
  );
}
