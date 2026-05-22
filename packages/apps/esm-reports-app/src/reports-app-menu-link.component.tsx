import { ConfigurableLink } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';

export default function ReportsAppMenuLink() {
  const { t } = useTranslation();
  return (
    <ConfigurableLink to={`${globalThis.spaBase}/reports`}>
      {t('reportsAppMenuLink', 'Informes y Estadísticas')}
    </ConfigurableLink>
  );
}
