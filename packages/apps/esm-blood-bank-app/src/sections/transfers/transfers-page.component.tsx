import { useTranslation } from 'react-i18next';

import { moduleName } from '../../constants';
import { SectionPlaceholderPage } from '../../shared/section-placeholder-page.component';

export function TransfersPage() {
  const { t } = useTranslation(moduleName);
  return <SectionPlaceholderPage title={t('transfers', 'Transferencias')} description={t('transfersDescription', 'Ingreso y salida de unidades entre establecimientos.')} />;
}
