import { useTranslation } from 'react-i18next';

import { LinkCard } from './card.component';

function LegacyAdminPageLink() {
  const { t } = useTranslation();

  return (
    <LinkCard header={t('config', 'Configurations')} viewLink="/openmrs/admin/index.htm">
      {t('legacyAdmin', 'Legacy Admin')}
    </LinkCard>
  );
}

export default LegacyAdminPageLink;
