import { useTranslation } from 'react-i18next';
import LabSummaryTile from '../components/summary-tile/lab-summary-tile.component';
import { useLabOrders } from '../laboratory.resource';

const AllLabRequestsTile = () => {
  const { t } = useTranslation();
  const { labOrders } = useLabOrders({ newOrdersOnly: true });

  return (
    <LabSummaryTile
      label={t('orders', 'Orders')}
      value={labOrders?.length}
      headerLabel={t('testsOrdered', 'Tests ordered')}
    />
  );
};

export default AllLabRequestsTile;
