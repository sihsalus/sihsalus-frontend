import { useTranslation } from 'react-i18next';

import FuaSummaryTile from '../components/summary-tiles/summary-tile.component';
import { useVisits } from '../hooks/use-visit';

const InProgressFuaRequestsTile = () => {
  const { t } = useTranslation();
  const { visits } = useVisits();

  return (
    <FuaSummaryTile
      label={t('activeFuas', 'Visitas')}
      value={visits?.length}
      headerLabel={t('inProcessHeader', 'Visitas')}
    />
  );
};

export default InProgressFuaRequestsTile;
