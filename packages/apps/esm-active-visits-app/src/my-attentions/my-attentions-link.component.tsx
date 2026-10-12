import { ConfigurableLink, UserHasAccess } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import { moduleName, myAttentionsPath, myAttentionsPrivileges } from './my-attentions.resource';

export default function MyAttentionsLink() {
  const { t } = useTranslation(moduleName);
  return (
    <UserHasAccess privilege={myAttentionsPrivileges} fallback={null}>
      <ConfigurableLink className="cds--side-nav__link" to={`${globalThis.spaBase}${myAttentionsPath}`}>
        {t('myAttentions', 'My care')}
      </ConfigurableLink>
    </UserHasAccess>
  );
}
