import { InlineLoading, Tag } from '@carbon/react';
import { useConfig } from '@openmrs/esm-framework';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type ConfigObject } from '../../config-schema';
import FlagsList from '../flags-list.component';
import { usePatientFlags } from '../hooks/usePatientFlags';
import styles from './flags-banner-tag.scss';

interface FlagsBannerTagExtensionProps {
  patientUuid: string;
}

const FlagsBannerTagExtension: React.FC<FlagsBannerTagExtensionProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const { flags, isLoading, error } = usePatientFlags(patientUuid);
  const config = useConfig<ConfigObject>();
  const [showFlagsList, setShowFlagsList] = useState(false);

  const riskPriorityNames = useMemo(() => {
    return (config.priorities ?? [])
      .filter((priority) => priority.isRiskPriority)
      .map((priority) => priority.priority.toLowerCase());
  }, [config.priorities]);

  const riskFlags = useMemo(() => {
    return flags.filter((flag) => {
      if (flag.voided) {
        return false;
      }
      const priorityName = flag.flagDefinition?.priority?.name?.toLowerCase() ?? '';
      return riskPriorityNames.includes(priorityName);
    });
  }, [flags, riskPriorityNames]);

  if (isLoading) {
    return <InlineLoading className={styles.loader} description={t('loading', 'Loading')} />;
  }

  if (error || riskFlags.length === 0) {
    return null;
  }

  return (
    <div className={styles.bannerFlags}>
      <Tag
        className={styles.flagsCountTag}
        type={showFlagsList ? 'outline' : 'high-contrast'}
        role="button"
        tabIndex={0}
        onClick={() => setShowFlagsList(!showFlagsList)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setShowFlagsList(!showFlagsList);
          }
        }}
      >
        <span className={styles.flagIcon}>&#128681;</span>
        {t('flagCount', '{{count}} risk flags', { count: riskFlags.length })}
      </Tag>
      {showFlagsList ? (
        <div className={styles.flagsPopover}>
          <FlagsList patientUuid={patientUuid} />
        </div>
      ) : null}
    </div>
  );
};

export default FlagsBannerTagExtension;
