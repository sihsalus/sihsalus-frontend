import { useTranslation } from 'react-i18next';
import LabSummaryTile from '../components/summary-tile/lab-summary-tile.component';
import { useLabOrders } from '../laboratory.resource';

const CompletedLabRequestsTile = () => {
  const { t } = useTranslation();
  const { labOrders } = useLabOrders({ status: 'COMPLETED', excludeCanceled: false });

  return (
    <LabSummaryTile
      label={t('completed', 'Completed')}
      value={labOrders?.length}
      headerLabel={t('results', 'Results')}
    />
  );
};

export default CompletedLabRequestsTile;
