import { useTranslation } from 'react-i18next';

import { moduleName } from '../../constants';
import { SectionPlaceholderPage } from '../../shared/section-placeholder-page.component';

export function RecipientFollowUpPage() {
  const { t } = useTranslation(moduleName);
  return <SectionPlaceholderPage title={t('recipientFollowUp', 'Seguimiento del receptor')} description={t('recipientFollowUpDescription', 'Seguimiento del receptor después de la transfusión.')} />;
}
