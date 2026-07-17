import { ConfigurableLink } from '@openmrs/esm-framework';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import { useTranslation } from 'react-i18next';

import { careLogbookBasePath, careLogbookPrivilege, moduleName } from '../constants';

export default function CareLogbookAppMenuLink() {
  const { t } = useTranslation(moduleName);

  return (
    <RequirePrivilege privilege={careLogbookPrivilege} hideUnauthorized>
      <ConfigurableLink to={`${globalThis.spaBase}${careLogbookBasePath}`}>
        {t('admission', 'Libro de Atenciones')}
      </ConfigurableLink>
    </RequirePrivilege>
  );
}
