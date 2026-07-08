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
import { useNutritionalAssessment } from '../../../../hooks/useNutritionalAssessment';

import styles from './nutritional-assessment.scss';

interface NutritionalAssessmentProps {
  patientUuid: string;
}

const NutritionalAssessment: React.FC<NutritionalAssessmentProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const session = useSession();
  const canEdit = userHasAccess(credNutritionEditPrivilege, session?.user);
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
        <Tag type={hasData ? 'green' : 'gray'} size="sm">
          {hasData ? (nutritionClassification ?? t('withData', 'Con datos')) : t('noData', 'Sin datos')}
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
