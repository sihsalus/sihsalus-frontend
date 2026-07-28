import { useTranslation } from 'react-i18next';

import FuaSummaryTile from '../components/summary-tiles/summary-tile.component';
import { useFuaRequests } from '../hooks/use-fua-requests';

const CompletedFuaRequestsTile = () => {
  const { t } = useTranslation();
  const { fuaOrders } = useFuaRequests({ status: 'COMPLETED', excludeCanceled: false });

  return (
    <FuaSummaryTile
      label={t('completed', 'Lista de Formatos FUA')}
      value={fuaOrders?.length}
      headerLabel={t('completedHeader', 'Lista de Formatos FUA')}
    />
  );
};

export default CompletedFuaRequestsTile;
