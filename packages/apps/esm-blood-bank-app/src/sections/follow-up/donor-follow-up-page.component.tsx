import { useTranslation } from 'react-i18next';

import { moduleName } from '../../constants';
import { SectionPlaceholderPage } from '../../shared/section-placeholder-page.component';

export function DonorFollowUpPage() {
  const { t } = useTranslation(moduleName);
  return <SectionPlaceholderPage title={t('donorFollowUp', 'Seguimiento del donante')} description={t('donorFollowUpDescription', 'Seguimiento de la persona donante y sus resultados.')} />;
}
