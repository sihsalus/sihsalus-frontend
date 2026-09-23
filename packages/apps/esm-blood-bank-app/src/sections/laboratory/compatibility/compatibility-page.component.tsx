import { useTranslation } from 'react-i18next';

import { moduleName } from '../../../constants';
import { SectionPlaceholderPage } from '../../../shared/section-placeholder-page.component';

export function CompatibilityPage() {
  const { t } = useTranslation(moduleName);
  return <SectionPlaceholderPage title={t('compatibility', 'Compatibilidad')} description={t('compatibilityDescription', 'Pruebas pretransfusionales y evaluación de compatibilidad.')} />;
}
