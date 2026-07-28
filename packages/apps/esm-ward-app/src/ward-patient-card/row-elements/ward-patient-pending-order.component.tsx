import { ChemistryReference } from '@carbon/react/icons';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePatientPendingOrders } from '../../hooks/use-patient-pending-orders';
import { type WardPatient } from '../../types';
import styles from '../ward-patient-card.scss';

export interface WardPatientPendingOrderProps {
  wardPatient: WardPatient;
  orderUuid: string;
  label: string;
  onOrderCount: (count: number) => void; // New prop for notifying parent
}

export const WardPatientPendingOrder: React.FC<WardPatientPendingOrderProps> = ({
  wardPatient,
  orderUuid,
  label,
  onOrderCount,
}) => {
  const { t } = useTranslation();
  const { count, isLoading } = usePatientPendingOrders(
    wardPatient?.patient?.uuid,
    orderUuid,
    wardPatient?.visit?.startDatetime.split('T')[0],
  );

  useEffect(() => {
    if (!isLoading) {
      onOrderCount(count); // Notify parent when count is available
    }
  }, [count, isLoading, onOrderCount]);

  if (isLoading || !count || count === 0) {
    return null;
  }

  const labelToDisplay = label ? t(label) : t('Orders', 'Orders');
  return (
    <div className={styles.wardPatientCardDispositionTypeContainer}>
      <ChemistryReference className={styles.chemistryReferenceIcon} size="24" />
      {count} {labelToDisplay}
    </div>
  );
};
