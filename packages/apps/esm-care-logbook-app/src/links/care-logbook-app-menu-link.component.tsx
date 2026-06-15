import { ConfigurableLink } from '@openmrs/esm-framework';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import { useTranslation } from 'react-i18next';

import { admissionPrivilege, basePath, moduleName } from '../constants';

export default function CareLogbookAppMenuLink() {
  const { t } = useTranslation(moduleName);

  return (
    <RequirePrivilege privilege={admissionPrivilege} hideUnauthorized>
      <ConfigurableLink to={`${globalThis.spaBase}${basePath}`}>
        {t('admission', 'Libro de Atenciones')}
      </ConfigurableLink>
    </RequirePrivilege>
  );
}
