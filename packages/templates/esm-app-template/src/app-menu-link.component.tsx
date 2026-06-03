import { ConfigurableLink } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';

import { basePath, moduleName } from './constants';

export default function AppMenuLink() {
  const { t } = useTranslation(moduleName);

  return (
    <ConfigurableLink to={`${globalThis.spaBase}${basePath}`}>{t('templateAppTitle', 'Template app')}</ConfigurableLink>
  );
}
