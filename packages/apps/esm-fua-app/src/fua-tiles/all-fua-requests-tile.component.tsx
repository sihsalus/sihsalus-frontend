import { useTranslation } from 'react-i18next';

import FuaSummaryTile from '../components/summary-tiles/summary-tile.component';
import { useFuaRequests } from '../hooks/use-fua-requests';

const AllFuaRequestsTile = () => {
  const { t } = useTranslation();

  const { fuaOrders } = useFuaRequests({ newOrdersOnly: true });

  return (
    <FuaSummaryTile
      label={t('totalFuas', 'Total FUAs')}
      value={fuaOrders?.length}
      headerLabel={t('fuasRequested', 'FUAs Solicitados')}
    />
  );
};

export default AllFuaRequestsTile;
