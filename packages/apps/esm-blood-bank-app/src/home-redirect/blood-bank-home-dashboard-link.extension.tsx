import { Home } from '@carbon/react/icons';
import { ConfigurableLink } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';

import { basePath, moduleName } from '../constants';

export default function BloodBankHomeDashboardLink() {
  const { t } = useTranslation(moduleName);

  return (
    <ConfigurableLink to={`${globalThis.spaBase}${basePath}`} className="cds--side-nav__link">
      <span className="sihsalus-side-nav__item">
        <Home aria-hidden="true" className="sihsalus-side-nav__icon" size={20} />
        <span className="sihsalus-side-nav__text">{t('appTitle', 'Banco de Sangre')}</span>
      </span>
    </ConfigurableLink>
  );
}
