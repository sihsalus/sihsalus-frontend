import { InlineNotification } from '@carbon/react';
import { useTranslation } from 'react-i18next';

import { moduleName } from '../constants';

export function DataErrorState() {
  const { t } = useTranslation(moduleName);

  return (
    <InlineNotification
      hideCloseButton
      kind="error"
      title={t('dataLoadErrorTitle', 'No se pudieron cargar los datos')}
      subtitle={t('dataLoadErrorMessage', 'Inténtelo nuevamente. Si el problema continúa, comuníquese con soporte.')}
    />
  );
}

export function EmptyState({ message }: { message: string }) {
  const { t } = useTranslation(moduleName);

  return <InlineNotification hideCloseButton kind="info" title={t('noResults', 'Sin resultados')} subtitle={message} />;
}
