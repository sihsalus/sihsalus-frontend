import { Button, Layer, SkeletonText, Tile } from '@carbon/react';
import { ArrowRightIcon, navigate, useSession } from '@openmrs/esm-framework';
import React, { type ComponentProps, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { useDynamicFormDataEntries } from './offline-form-helpers';
import styles from './offline-forms-overview-card.scss';

const OfflineFormsOverviewCard: React.FC = () => {
  const { t } = useTranslation();
  const session = useSession();
  const { data, error } = useDynamicFormDataEntries(session?.user?.uuid);
  const isLoading = Boolean(session?.user?.uuid) && !error && !data;

  return (
    <Layer>
      <Tile className={styles.overviewCard}>
        <div className={styles.headerContainer}>
          <h3 className={styles.heading}>{t('forms', 'Forms')}</h3>
          <Button
            className={styles.viewButton}
            kind="ghost"
            renderIcon={(props: ComponentProps<typeof ArrowRightIcon>) => <ArrowRightIcon size={16} {...props} />}
            size="sm"
            onClick={() => navigate({ to: `${globalThis.spaBase}/offline-tools/forms` })}
          >
            {t('homeOverviewCardView', 'View')}
          </Button>
        </div>
        <div className={styles.contentContainer}>
          <HeaderedQuickInfo
            header={t('offlineFormsOverviewCardAvailableOffline', 'Available offline')}
            isLoading={isLoading}
          >
            {error ? t('unknown', 'Unknown') : (data?.length ?? 0)}
          </HeaderedQuickInfo>
        </div>
      </Tile>
    </Layer>
  );
};

export interface HeaderedQuickInfoProps {
  header: string;
  isLoading?: boolean;
  children?: ReactNode;
}

const HeaderedQuickInfo: React.FC<HeaderedQuickInfoProps> = ({ header, children, isLoading = false }) => {
  return (
    <div>
      <h4 className={styles.label}>{header}</h4>
      {isLoading ? <SkeletonText heading /> : <span className={styles.heading}>{children}</span>}
    </div>
  );
};

export default OfflineFormsOverviewCard;
