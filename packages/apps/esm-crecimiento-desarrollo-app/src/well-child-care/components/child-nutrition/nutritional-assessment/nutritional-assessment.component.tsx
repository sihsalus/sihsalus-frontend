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
import { launchWorkspace2, useConfig } from '@openmrs/esm-framework';
import { CardHeader, ErrorState } from '@openmrs/esm-patient-common-lib';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../../../../config-schema';
import { useNutritionalAssessment } from '../../../../hooks/useNutritionalAssessment';
import { formEntryWorkspace } from '../../../../types';

import styles from './nutritional-assessment.scss';

interface NutritionalAssessmentProps {
  patientUuid: string;
}

const NutritionalAssessment: React.FC<NutritionalAssessmentProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();
  const { weightForAge, heightForAge, weightForHeight, lastMeasurementDate, isLoading, error } =
    useNutritionalAssessment(patientUuid);
  const headerTitle = t('cnAssessmentTitle', 'Estado nutricional');

  const hasData = weightForAge || heightForAge || weightForHeight;

  const handleAdd = useCallback(() => {
    const formUuid = config.formsList.nutritionalAssessmentForm;
    if (!formUuid) return;
    launchWorkspace2(formEntryWorkspace, {
      form: { uuid: formUuid },
      encounterUuid: '',
    });
  }, [config.formsList.nutritionalAssessmentForm]);

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
        <Button kind="ghost" size="sm" renderIcon={Add} onClick={handleAdd} iconDescription={t('add', 'Add')}>
          {t('add', 'Add')}
        </Button>
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
