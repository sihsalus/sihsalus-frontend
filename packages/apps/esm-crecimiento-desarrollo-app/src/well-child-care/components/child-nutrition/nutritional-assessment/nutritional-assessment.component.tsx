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
import { credNutritionEditPrivilege } from '../../../../constants';
import { useCREDFormLauncher } from '../../../../hooks/useCREDFormLauncher';
import { useNutritionalAssessment } from '../../../../hooks/useNutritionalAssessment';
import { useHasPrivilege } from '../../../../rbac';

import styles from './nutritional-assessment.scss';

interface NutritionalAssessmentProps {
  patientUuid: string;
}

const NutritionalAssessment: React.FC<NutritionalAssessmentProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const canEdit = useHasPrivilege(credNutritionEditPrivilege);
  const { weightForAge, heightForAge, weightForHeight, lastMeasurementDate, isLoading, error } =
    useNutritionalAssessment(patientUuid);
  const { launchForm: handleAdd, isLoading: isFormLoading } = useCREDFormLauncher('nutritionalAssessmentForm');
  const headerTitle = t('cnAssessmentTitle', 'Estado nutricional');

  const hasData = weightForAge || heightForAge || weightForHeight;

  if (isLoading) {
    return <DataTableSkeleton size="sm" rowCount={4} columnCount={2} />;
  }

  if (error) {
    return <ErrorState error={error} headerTitle={headerTitle} />;
  }

  return (
    <div className={styles.widgetCard}>
      <CardHeader title={headerTitle}>
        <Tag type={hasData ? 'green' : 'gray'} size="sm">
          {hasData ? (weightForAge ?? t('noData', 'Sin datos')) : t('noData', 'Sin datos')}
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
              <StructuredListCell className={styles.label}>{t('cnWeightForAge', 'Peso/Edad (P/E)')}</StructuredListCell>
              <StructuredListCell className={styles.value}>
                {weightForAge ?? <span className={styles.noData}>{t('noData', 'Sin datos')}</span>}
              </StructuredListCell>
            </StructuredListRow>
            <StructuredListRow>
              <StructuredListCell className={styles.label}>
                {t('cnHeightForAge', 'Talla/Edad (T/E)')}
              </StructuredListCell>
              <StructuredListCell className={styles.value}>
                {heightForAge ?? <span className={styles.noData}>{t('noData', 'Sin datos')}</span>}
              </StructuredListCell>
            </StructuredListRow>
            <StructuredListRow>
              <StructuredListCell className={styles.label}>
                {t('cnWeightForHeight', 'Peso/Talla (P/T)')}
              </StructuredListCell>
              <StructuredListCell className={styles.value}>
                {weightForHeight ?? <span className={styles.noData}>{t('noData', 'Sin datos')}</span>}
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
