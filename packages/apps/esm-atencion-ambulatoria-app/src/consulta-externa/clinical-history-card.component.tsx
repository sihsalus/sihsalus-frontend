import { Button, DataTableSkeleton, InlineLoading } from '@carbon/react';
import { Add } from '@carbon/react/icons';
import { useLayoutType } from '@openmrs/esm-framework';
import { CardHeader, ErrorState } from '@openmrs/esm-patient-common-lib';
import React from 'react';
import styles from './consulta-externa-dashboard.scss';

interface ClinicalHistoryCardProps {
  title: string;
  actionLabel?: string;
  children?: React.ReactNode;
  empty?: boolean;
  emptyMessage?: string;
  error?: unknown;
  isLoading?: boolean;
  isValidating?: boolean;
  onAction?: () => void;
}

const ClinicalHistoryCard: React.FC<ClinicalHistoryCardProps> = ({
  title,
  actionLabel,
  children,
  empty,
  emptyMessage,
  error,
  isLoading,
  isValidating,
  onAction,
}) => {
  const isTablet = useLayoutType() === 'tablet';

  if (isLoading) {
    return <DataTableSkeleton role="progressbar" size={isTablet ? 'lg' : 'sm'} zebra />;
  }

  if (error) {
    return <ErrorState error={error} headerTitle={title} />;
  }

  return (
    <div className={styles.widgetCard}>
      <CardHeader title={title}>
        <div className={styles.historyHeaderActionItems}>
          {isValidating ? <InlineLoading /> : null}
          {onAction && actionLabel ? (
            <Button kind="ghost" size={isTablet ? 'md' : 'sm'} renderIcon={Add} onClick={onAction}>
              {actionLabel}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      {empty ? (
        <div className={styles.cardEmptyState}>
          <p>{emptyMessage}</p>
        </div>
      ) : (
        <div className={styles.cardBody}>{children}</div>
      )}
    </div>
  );
};

export default ClinicalHistoryCard;
