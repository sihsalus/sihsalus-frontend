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
import { growthDevelopmentWritePrivileges } from '../../../../constants';
import { useCREDFormLauncher } from '../../../../hooks/useCREDFormLauncher';
import { useNutritionalAssessment } from '../../../../hooks/useNutritionalAssessment';
import { CardHeaderActions } from '../../../../ui/card-header-actions.component';

import styles from './nutritional-assessment.scss';

interface NutritionalAssessmentProps {
  patientUuid: string;
}

const NutritionalAssessment: React.FC<NutritionalAssessmentProps> = ({ patientUuid }) => {
  const { t } = useTranslation('@sihsalus/esm-cred-app');
  const session = useSession();
  const canEdit = userHasAccess(growthDevelopmentWritePrivileges, session?.user);
  const { nutritionClassification, weight, height, lastMeasurementDate, isLoading, error } =
    useNutritionalAssessment(patientUuid);
  const { launchForm: handleAdd, isLoading: isFormLoading } = useCREDFormLauncher('nutritionalAssessmentForm');
  const headerTitle = t('cnAssessmentTitle', 'Estado nutricional');

  const hasData = nutritionClassification || weight || height;

  if (isLoading) {
    return <DataTableSkeleton size="sm" rowCount={4} columnCount={2} />;
  }

  if (error) {
    return <ErrorState error={error} headerTitle={headerTitle} />;
  }

  return (
    <div className={styles.widgetCard}>
      <CardHeader title={headerTitle}>
        <CardHeaderActions
          status={
            <Tag type="gray" size="sm">
              {hasData ? (nutritionClassification ?? t('withData', 'Con datos')) : t('noData', 'Sin datos')}
            </Tag>
          }
          showAction={canEdit}
          action={
            <Button
              kind="ghost"
              size="sm"
              renderIcon={Add}
              onClick={canEdit ? () => handleAdd() : undefined}
              iconDescription={t('add', 'Add')}
              disabled={!canEdit || isFormLoading}
            >
              {t('add', 'Add')}
            </Button>
          }
        />
      </CardHeader>
      <div className={styles.container}>
        <StructuredListWrapper isCondensed>
          <StructuredListBody>
            <StructuredListRow>
              <StructuredListCell className={styles.label}>
                {t('cnNutritionClassification', 'Clasificación nutricional')}
              </StructuredListCell>
              <StructuredListCell className={styles.value}>
                {nutritionClassification ?? <span className={styles.noData}>{t('noData', 'Sin datos')}</span>}
              </StructuredListCell>
            </StructuredListRow>
            <StructuredListRow>
              <StructuredListCell className={styles.label}>{t('cnWeight', 'Peso')}</StructuredListCell>
              <StructuredListCell className={styles.value}>
                {weight ?? <span className={styles.noData}>{t('noData', 'Sin datos')}</span>}
              </StructuredListCell>
            </StructuredListRow>
            <StructuredListRow>
              <StructuredListCell className={styles.label}>{t('cnHeight', 'Talla')}</StructuredListCell>
              <StructuredListCell className={styles.value}>
                {height ?? <span className={styles.noData}>{t('noData', 'Sin datos')}</span>}
              </StructuredListCell>
            </StructuredListRow>
            <StructuredListRow>
              <StructuredListCell className={styles.label}>
                {t('cnLastMeasurement', 'Última medición')}
              </StructuredListCell>
              <StructuredListCell className={styles.value}>
                {lastMeasurementDate ?? <span className={styles.noData}>{t('noData', 'Sin datos')}</span>}
              </StructuredListCell>
            </StructuredListRow>
          </StructuredListBody>
        </StructuredListWrapper>
      </div>
    </div>
  );
};

export default NutritionalAssessment;
