import { InlineLoading } from '@carbon/react';
import { useTranslation } from 'react-i18next';

import { moduleName } from '../constants';

export function LoadingState() {
  const { t } = useTranslation(moduleName);
  return <InlineLoading description={t('loadingData', 'Cargando datos…')} />;
}
