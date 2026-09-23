import { useTranslation } from 'react-i18next';

import { moduleName } from '../../../constants';
import { SectionPlaceholderPage } from '../../../shared/section-placeholder-page.component';

export function ScreeningPage() {
  const { t } = useTranslation(moduleName);
  return <SectionPlaceholderPage title={t('donorScreening', 'Tamizaje de donantes')} description={t('screeningDescription', 'Registro y validación de pruebas de tamizaje del donante.')} />;
}
