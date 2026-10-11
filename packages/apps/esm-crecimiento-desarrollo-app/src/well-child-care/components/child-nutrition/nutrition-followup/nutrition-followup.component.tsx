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
import { useNutritionFollowup } from '../../../../hooks/useNutritionFollowup';

import styles from '../../../../ui/summary-card.scss';

interface NutritionFollowupProps {
  patientUuid: string;
}

const NutritionFollowup: React.FC<NutritionFollowupProps> = ({ patientUuid }) => {
  const { t } = useTranslation('@sihsalus/esm-cred-app');
  const session = useSession();
  const canEdit = userHasAccess(credNutritionEditPrivilege, session?.user);
  const { nutritionClassification, evolution, referral, lastFollowupDate, isLoading, error } =
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
        <div className={styles.headerActions}>
          <Tag type={lastFollowupDate ? 'blue' : 'gray'} size="sm">
            {lastFollowupDate ? t('cnRecorded', 'Registrado') : t('pending', 'Pending')}
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
        </div>
      </CardHeader>
      <div className={styles.container}>
        <StructuredListWrapper isCondensed>
          <StructuredListBody>
            <StructuredListRow>
              <StructuredListCell className={styles.label}>
                {t('cnClassification', 'Clasificación nutricional')}
              </StructuredListCell>
              <StructuredListCell className={styles.value}>
                {nutritionClassification ?? <span className={styles.noData}>{t('noData', 'Sin datos')}</span>}
              </StructuredListCell>
            </StructuredListRow>
            <StructuredListRow>
              <StructuredListCell className={styles.label}>
                {t('cnRecordedEvolution', 'Evolución registrada')}
              </StructuredListCell>
              <StructuredListCell className={styles.value}>
                {evolution ?? <span className={styles.noData}>{t('noData', 'Sin datos')}</span>}
              </StructuredListCell>
            </StructuredListRow>
            <StructuredListRow>
              <StructuredListCell className={styles.label}>
                {t('cnRecordedReferral', 'Requiere referencia (registrado)')}
              </StructuredListCell>
              <StructuredListCell className={styles.value}>
                {referral != null ? referral : <span className={styles.noData}>{t('noData', 'Sin datos')}</span>}
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
