import { useTranslation } from 'react-i18next';
import LabSummaryTile from '../components/summary-tile/lab-summary-tile.component';
import { useLabOrders } from '../laboratory.resource';

const PendingReviewLabRequestsTile = () => {
  const { t } = useTranslation();
  const { labOrders } = useLabOrders({
    status: 'DRAFT',
    excludeCanceled: false,
  });

  return (
    <LabSummaryTile
      label={t('pendingReview', 'Pending Review')}
      value={labOrders?.length}
      headerLabel={t('awaitingApproval', 'Awaiting Approval')}
    />
  );
};

export default PendingReviewLabRequestsTile;
