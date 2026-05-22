import { useTranslation } from 'react-i18next';
import LabSummaryTile from '../components/summary-tile/lab-summary-tile.component';
import { useLabOrders } from '../laboratory.resource';

const InProgressLabRequestsTile = () => {
  const { t } = useTranslation();
  const { labOrders } = useLabOrders({ status: 'IN_PROGRESS' });

  return (
    <LabSummaryTile
      label={t('inProgress', 'In progress')}
      value={labOrders?.length}
      headerLabel={t('worklist', 'Worklist')}
    />
  );
};

export default InProgressLabRequestsTile;
