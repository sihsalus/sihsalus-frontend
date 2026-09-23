import { useTranslation } from 'react-i18next';

import { moduleName } from '../../../constants';
import { SectionPlaceholderPage } from '../../../shared/section-placeholder-page.component';

export function FractionationPage() {
  const { t } = useTranslation(moduleName);
  return <SectionPlaceholderPage title={t('fractionation', 'Fraccionamiento')} description={t('fractionationDescription', 'Producción y trazabilidad de hemocomponentes.')} />;
}
