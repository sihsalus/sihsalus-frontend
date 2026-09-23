import { useTranslation } from 'react-i18next';

import { moduleName } from '../../constants';
import { SectionPlaceholderPage } from '../../shared/section-placeholder-page.component';

export function CollectionPage() {
  const { t } = useTranslation(moduleName);
  return <SectionPlaceholderPage title={t('collectionAndApheresis', 'Extracción y aféresis')} description={t('collectionDescription', 'Registro de sangre total, aféresis, insumos y resultado del procedimiento.')} />;
}
