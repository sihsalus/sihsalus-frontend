import { ConfigurableLink } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';

export default function OfflineToolsAppMenuLink() {
  const { t } = useTranslation();
  return (
    <ConfigurableLink to="${openmrsSpaBase}/offline-tools">
      {t('offlineToolsAppMenuLink', 'Offline tools')}
    </ConfigurableLink>
  );
}
