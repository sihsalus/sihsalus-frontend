import { Button, DataTableSkeleton, ProgressBar, Tag } from '@carbon/react';
import { Add } from '@carbon/react/icons';
import { CardHeader, ErrorState } from '@openmrs/esm-patient-common-lib';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useCREDFormLauncher } from '../../../hooks/useCREDFormLauncher';
import { useSupplementationTracker } from '../../../hooks/useSupplementationTracker';

import styles from './supplementation-tracker.scss';

interface SupplementationTrackerProps {
  patientUuid: string;
}

const SupplementationTracker: React.FC<SupplementationTrackerProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const { delivered, total, percentage, isComplete, isLoading, error } = useSupplementationTracker(patientUuid);
  const { launchForm: handleAdd, isLoading: isFormLoading } = useCREDFormLauncher('supplementationForm');
  const headerTitle = t('mmnSupplementation', 'Suplementación MMN');

  if (isLoading) {
    return <DataTableSkeleton size="sm" rowCount={2} columnCount={2} />;
  }

  if (error) {
    return <ErrorState error={error} headerTitle={headerTitle} />;
  }

  return (
    <div className={styles.widgetCard}>
      <CardHeader title={headerTitle}>
        <Tag type={isComplete ? 'green' : 'blue'} size="sm">
          {isComplete ? t('complete', 'Completo') : t('inProgress', 'En curso')}
        </Tag>
        <Button
          kind="ghost"
          size="sm"
          renderIcon={Add}
          onClick={() => handleAdd()}
          iconDescription={t('add', 'Add')}
          disabled={isFormLoading}
        >
          {t('add', 'Add')}
        </Button>
      </CardHeader>
      <div className={styles.container}>
        <div className={styles.progressRow}>
          <div className={styles.progressBarWrapper}>
            <ProgressBar
              label={`${delivered}/${total} ${t('sachets', 'sobres')}`}
              value={percentage}
              size="small"
              status={isComplete ? 'finished' : 'active'}
            />
          </div>
          <span className={styles.percentageLabel}>{Math.round(percentage)}%</span>
        </div>
        <p className={styles.helperText}>{t('mmnDescription', 'Directiva 068: 1 sobre diario desde los 6 meses')}</p>
      </div>
    </div>
  );
};

export default SupplementationTracker;
