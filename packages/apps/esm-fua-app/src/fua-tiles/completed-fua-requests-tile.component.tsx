import { useTranslation } from 'react-i18next';

import FuaSummaryTile from '../components/summary-tiles/summary-tile.component';
import useFuaFormats from '../hooks/useFuaFormats';

const CompletedFuaRequestsTile = () => {
  const { t } = useTranslation();
  const { fuaFormats } = useFuaFormats();

  return (
    <FuaSummaryTile
      label={t('completed', 'Lista de Formatos FUA')}
      value={fuaFormats?.length}
      headerLabel={t('completedHeader', 'Lista de Formatos FUA')}
    />
  );
};

export default CompletedFuaRequestsTile;
