import { useTranslation } from 'react-i18next';

import { moduleName } from '../../constants';
import { SectionPlaceholderPage } from '../../shared/section-placeholder-page.component';

export function TransfusionsPage() {
  const { t } = useTranslation(moduleName);
  return <SectionPlaceholderPage title={t('transfusions', 'Transfusiones')} description={t('transfusionsDescription', 'Solicitudes, reservas, entrega y registro transfusional.')} />;
}
