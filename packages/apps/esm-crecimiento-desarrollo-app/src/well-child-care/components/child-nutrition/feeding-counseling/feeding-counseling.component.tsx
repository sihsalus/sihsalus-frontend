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
import { userHasAccess, useSession } from '@openmrs/esm-framework';
import { CardHeader, ErrorState } from '@openmrs/esm-patient-common-lib';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { credNutritionEditPrivilege } from '../../../../constants';
import { useCREDFormLauncher } from '../../../../hooks/useCREDFormLauncher';
import { useFeedingAssessment } from '../../../../hooks/useFeedingAssessment';

import styles from './feeding-counseling.scss';

interface FeedingCounselingProps {
  patientUuid: string;
}

const FeedingCounseling: React.FC<FeedingCounselingProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const session = useSession();
  const canEdit = userHasAccess(credNutritionEditPrivilege, session?.user);
  const { feedingType, lastAssessmentDate, isBreastfeeding, isLoading, error } = useFeedingAssessment(patientUuid);
  const { launchForm: handleAdd, isLoading: isFormLoading } = useCREDFormLauncher('feedingCounselingForm');
  const headerTitle = t('cnCounselingTitle', 'Consejería alimentaria');

  if (isLoading) {
    return <DataTableSkeleton size="sm" rowCount={3} columnCount={2} />;
  }

  if (error) {
    return <ErrorState error={error} headerTitle={headerTitle} />;
  }

  return (
    <div className={styles.widgetCard}>
      <CardHeader title={headerTitle}>
        <Tag type={lastAssessmentDate ? 'green' : 'gray'} size="sm">
          {lastAssessmentDate ? t('completed', 'Completed') : t('pending', 'Pending')}
        </Tag>
        {canEdit && (
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
        )}
      </CardHeader>
      <div className={styles.container}>
        <StructuredListWrapper isCondensed>
          <StructuredListBody>
            <StructuredListRow>
              <StructuredListCell className={styles.label}>
                {t('cnFeedingType', 'Tipo de alimentación')}
              </StructuredListCell>
              <StructuredListCell className={styles.value}>
                {feedingType ?? <span className={styles.noData}>{t('noData', 'Sin datos')}</span>}
              </StructuredListCell>
            </StructuredListRow>
            <StructuredListRow>
              <StructuredListCell className={styles.label}>
                {t('cnBreastfeeding', 'Lactancia Materna')}
              </StructuredListCell>
              <StructuredListCell className={styles.value}>
                {isBreastfeeding != null ? (
                  isBreastfeeding ? (
                    t('yes', 'Sí')
                  ) : (
                    t('no', 'No')
                  )
                ) : (
                  <span className={styles.noData}>{t('noData', 'Sin datos')}</span>
                )}
              </StructuredListCell>
            </StructuredListRow>
            <StructuredListRow>
              <StructuredListCell className={styles.label}>{t('lastSession', 'Última sesión')}</StructuredListCell>
              <StructuredListCell className={styles.value}>
                {lastAssessmentDate ?? <span className={styles.noData}>{t('noData', 'Sin datos')}</span>}
              </StructuredListCell>
            </StructuredListRow>
          </StructuredListBody>
        </StructuredListWrapper>
      </div>
    </div>
  );
};

export default FeedingCounseling;
