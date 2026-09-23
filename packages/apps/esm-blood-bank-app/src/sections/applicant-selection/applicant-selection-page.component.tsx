import { useTranslation } from 'react-i18next';

import { moduleName } from '../../constants';
import { SectionPlaceholderPage } from '../../shared/section-placeholder-page.component';

export function ApplicantSelectionPage() {
  const { t } = useTranslation(moduleName);
  return <SectionPlaceholderPage title={t('applicantSelection', 'Selección del postulante')} description={t('applicantSelectionDescription', 'Evaluación, entrevista y decisión de aptitud del postulante.')} />;
}
