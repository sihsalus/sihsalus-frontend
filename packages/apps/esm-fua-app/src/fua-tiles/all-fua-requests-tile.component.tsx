import { useTranslation } from 'react-i18next';

import FuaSummaryTile from '../components/summary-tiles/summary-tile.component';
import { useFuaRequests } from '../hooks/useFuaRequests';

const AllFuaRequestsTile = () => {
  const { t } = useTranslation();

  const { fuaOrders } = useFuaRequests({ status: null, excludeCanceled: true });

  return (
    <FuaSummaryTile
      label={t('totalFuas', 'Total FUAs')}
      value={fuaOrders?.length}
      headerLabel={t('fuasRequested', 'FUAs Solicitados')}
    />
  );
};

export default AllFuaRequestsTile;
