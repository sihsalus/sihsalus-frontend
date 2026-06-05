import { ConfigurableLink, useSession } from '@openmrs/esm-framework';
import { AppErrorBoundary } from '@sihsalus/esm-rbac';
import { useTranslation } from 'react-i18next';

import { admissionPrivilege, basePath, moduleName } from '../constants';

export default function AdmissionAppMenuLink() {
  const session = useSession();
  const { t } = useTranslation(moduleName);

  return (
    <AppErrorBoundary
      appName="esm-admission-app"
      checkAccess={true}
      privilegesRequired={[admissionPrivilege]}
      user={session}
      disappear={true}
    >
      <ConfigurableLink to={`${globalThis.spaBase}${basePath}`}>
        {t('admission', 'Libro de Atenciones')}
      </ConfigurableLink>
    </AppErrorBoundary>
  );
}
