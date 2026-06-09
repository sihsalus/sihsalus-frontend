import {
  Button,
  DataTableSkeleton,
  StructuredListBody,
  StructuredListCell,
  StructuredListRow,
  StructuredListWrapper,
  Tag,
} from '@carbon/react';
import { Add } from '@carbon/react/icons';
import { CardHeader, ErrorState } from '@openmrs/esm-patient-common-lib';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useCREDFormLauncher } from '../../../../hooks/useCREDFormLauncher';
import { useNutritionFollowup } from '../../../../hooks/useNutritionFollowup';

import styles from './nutrition-followup.scss';

interface NutritionFollowupProps {
  patientUuid: string;
}

const NutritionFollowup: React.FC<NutritionFollowupProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const { mmnStatus, ironStatus, counselingCount, lastFollowupDate, isLoading, error } =
    useNutritionFollowup(patientUuid);
  const { launchForm: handleAdd, isLoading: isFormLoading } = useCREDFormLauncher('nutritionFollowupForm');
  const headerTitle = t('cnFollowUpTitle', 'Seguimiento nutricional');

  if (isLoading) {
    return <DataTableSkeleton size="sm" rowCount={4} columnCount={2} />;
  }

  if (error) {
    return <ErrorState error={error} headerTitle={headerTitle} />;
  }

  return (
    <div className={styles.widgetCard}>
      <CardHeader title={headerTitle}>
        <Tag type={lastFollowupDate ? 'blue' : 'gray'} size="sm">
          {lastFollowupDate ? t('inProgress', 'En curso') : t('pending', 'Pending')}
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
        <StructuredListWrapper isCondensed>
          <StructuredListBody>
            <StructuredListRow>
              <StructuredListCell className={styles.label}>{t('cnMmnStatus', 'Suplementación MMN')}</StructuredListCell>
              <StructuredListCell className={styles.value}>
                {mmnStatus ?? <span className={styles.noData}>{t('noData', 'Sin datos')}</span>}
              </StructuredListCell>
            </StructuredListRow>
            <StructuredListRow>
              <StructuredListCell className={styles.label}>
                {t('cnIronSupplement', 'Suplemento de Hierro')}
              </StructuredListCell>
              <StructuredListCell className={styles.value}>
                {ironStatus ?? <span className={styles.noData}>{t('noData', 'Sin datos')}</span>}
              </StructuredListCell>
            </StructuredListRow>
            <StructuredListRow>
              <StructuredListCell className={styles.label}>
                {t('cnCounselingCount', 'Sesiones de Consejería')}
              </StructuredListCell>
              <StructuredListCell className={styles.value}>
                {counselingCount != null ? (
                  counselingCount
                ) : (
                  <span className={styles.noData}>{t('noData', 'Sin datos')}</span>
                )}
              </StructuredListCell>
            </StructuredListRow>
            <StructuredListRow>
              <StructuredListCell className={styles.label}>
                {t('cnLastFollowup', 'Último seguimiento')}
              </StructuredListCell>
              <StructuredListCell className={styles.value}>
                {lastFollowupDate ?? <span className={styles.noData}>{t('pending', 'Pending')}</span>}
              </StructuredListCell>
            </StructuredListRow>
          </StructuredListBody>
        </StructuredListWrapper>
      </div>
    </div>
  );
};

export default NutritionFollowup;
