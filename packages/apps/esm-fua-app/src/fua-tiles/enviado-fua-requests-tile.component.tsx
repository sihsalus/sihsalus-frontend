import { useTranslation } from 'react-i18next';

import FuaSummaryTile from '../components/summary-tiles/summary-tile.component';
import { useFuaRequests } from '../hooks/use-fua-requests';

const EnviadoFuaRequestsTile = () => {
  const { t } = useTranslation();
  const { fuaOrders } = useFuaRequests({ status: 'ENVIADO' });

  return (
    <FuaSummaryTile
      label={t('sentFuas', 'FUAs enviados')}
      value={fuaOrders?.length}
      headerLabel={t('sentHeader', 'Enviados a SETI-SIS')}
    />
  );
};

export default EnviadoFuaRequestsTile;
