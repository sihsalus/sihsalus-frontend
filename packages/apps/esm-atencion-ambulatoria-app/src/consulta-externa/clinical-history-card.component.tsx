import {
  AccordionSkeleton,
  Button,
  DataTableSkeleton,
  type DataTableSkeletonProps,
  InlineLoading,
  PaginationNav,
} from '@carbon/react';
import { Add } from '@carbon/react/icons';
import { useLayoutType } from '@openmrs/esm-framework';
import { CardHeader, EmptyState, ErrorState } from '@openmrs/esm-patient-common-lib';
import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './consulta-externa-dashboard.scss';

interface ClinicalHistoryPagination {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

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
  onSecondaryAction?: () => void;
  pagination?: ClinicalHistoryPagination;
  secondaryActionIcon?: React.ComponentType;
  secondaryActionLabel?: string;
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
  onSecondaryAction,
  pagination,
  secondaryActionIcon,
  secondaryActionLabel,
  skeletonHeaders,
}) => {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const hasPagination = pagination && pagination.totalPages > 1;
  const hasSecondaryAction = Boolean(onSecondaryAction && secondaryActionLabel);

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

  // With a secondary action the full card renders even when empty, so the
  // action stays reachable (e.g. prescribing for a patient with no history yet).
  if (empty && !hasPagination && !hasSecondaryAction) {
    return <EmptyState displayText={emptyDisplayText} headerTitle={title} launchForm={onAction} />;
  }

  return (
    <div className={styles.widgetCard} role="region" aria-label={title}>
      <CardHeader title={title}>
        <div className={styles.historyHeaderActionItems}>
          {isValidating ? <InlineLoading /> : null}
          {hasSecondaryAction ? (
            <Button kind="ghost" size={isTablet ? 'lg' : 'sm'} renderIcon={secondaryActionIcon} onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </Button>
          ) : null}
          {onAction && actionLabel ? (
            <Button kind="ghost" size={isTablet ? 'lg' : 'sm'} renderIcon={Add} onClick={onAction}>
              {actionLabel}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <div className={styles.cardBody}>
        {empty ? (
          <p className={styles.emptyPage} role="status">
            {t('noClinicalHistoryOnThisPage', 'No hay {{displayText}} en esta página.', {
              displayText: emptyDisplayText,
            })}
          </p>
        ) : (
          children
        )}
      </div>
      {hasPagination ? (
        <div className={styles.pagination}>
          <PaginationNav
            aria-label={t('clinicalHistoryPagination', 'Páginas de {{title}}', { title })}
            itemsShown={5}
            onChange={(page) => pagination.onPageChange(page + 1)}
            page={pagination.currentPage - 1}
            size="sm"
            totalItems={pagination.totalPages}
          />
        </div>
      ) : null}
    </div>
  );
};

export default ClinicalHistoryCard;
