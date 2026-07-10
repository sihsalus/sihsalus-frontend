import {
  AccordionSkeleton,
  Button,
  DataTableSkeleton,
  type DataTableSkeletonProps,
  InlineLoading,
} from '@carbon/react';
import { Add } from '@carbon/react/icons';
import { useLayoutType } from '@openmrs/esm-framework';
import { CardHeader, EmptyState, ErrorState } from '@openmrs/esm-patient-common-lib';
import React from 'react';
import styles from './consulta-externa-dashboard.scss';

interface ClinicalHistoryCardProps {
  title: string;
  actionLabel?: string;
  children?: React.ReactNode;
  empty?: boolean;
  emptyDisplayText: string;
  error?: unknown;
  isLoading?: boolean;
  isValidating?: boolean;
  loadingVariant?: 'accordion' | 'table';
  onAction?: () => void;
  skeletonHeaders?: DataTableSkeletonProps['headers'];
}

const ClinicalHistoryCard: React.FC<ClinicalHistoryCardProps> = ({
  title,
  actionLabel,
  children,
  empty,
  emptyDisplayText,
  error,
  isLoading,
  isValidating,
  loadingVariant = 'table',
  onAction,
  skeletonHeaders,
}) => {
  const isTablet = useLayoutType() === 'tablet';

  if (isLoading) {
    return (
      <div className={styles.widgetCard} role="region" aria-label={title} aria-busy="true">
        <CardHeader title={title}>{null}</CardHeader>
        <div className={styles.cardBody}>
          {loadingVariant === 'accordion' ? (
            <div role="progressbar" aria-label={title}>
              <AccordionSkeleton count={3} open={false} />
            </div>
          ) : (
            <DataTableSkeleton
              role="progressbar"
              aria-label={title}
              columnCount={skeletonHeaders?.length}
              headers={skeletonHeaders}
              rowCount={3}
              showHeader={false}
              showToolbar={false}
              size={isTablet ? 'lg' : 'sm'}
              zebra
            />
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorState error={error} headerTitle={title} />;
  }

  if (empty) {
    return <EmptyState displayText={emptyDisplayText} headerTitle={title} launchForm={onAction} />;
  }

  return (
    <div className={styles.widgetCard} role="region" aria-label={title}>
      <CardHeader title={title}>
        <div className={styles.historyHeaderActionItems}>
          {isValidating ? <InlineLoading /> : null}
          {onAction && actionLabel ? (
            <Button kind="ghost" size={isTablet ? 'lg' : 'sm'} renderIcon={Add} onClick={onAction}>
              {actionLabel}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <div className={styles.cardBody}>{children}</div>
    </div>
  );
};

export default ClinicalHistoryCard;
