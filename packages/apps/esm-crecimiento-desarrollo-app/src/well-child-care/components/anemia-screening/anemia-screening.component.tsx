import {
  Button,
  DataTableSkeleton,
  StructuredListBody,
  StructuredListCell,
  StructuredListRow,
  StructuredListWrapper,
  Tag,
} from '@carbon/react';
import { Add, CheckmarkFilled, WarningFilled } from '@carbon/react/icons';
import { CardHeader, ErrorState } from '@openmrs/esm-patient-common-lib';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAnemiaScreening } from '../../../hooks/useAnemiaScreening';
import { useCREDFormLauncher } from '../../../hooks/useCREDFormLauncher';

import styles from './anemia-screening.scss';

interface AnemiaScreeningProps {
  patientUuid: string;
}

const AnemiaScreening: React.FC<AnemiaScreeningProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const { lastHb, lastDate, isAnemic, nextDueDate, isLoading, error } = useAnemiaScreening(patientUuid);
  const { launchForm: handleAdd, isLoading: isFormLoading } = useCREDFormLauncher('anemiaScreeningForm');
  const headerTitle = t('anemiaScreening', 'Tamizaje de Anemia');

  if (isLoading) {
    return <DataTableSkeleton size="sm" rowCount={3} columnCount={2} />;
  }

  if (error) {
    return <ErrorState error={error} headerTitle={headerTitle} />;
  }

  return (
    <div className={styles.widgetCard}>
      <CardHeader title={headerTitle}>
        {lastHb !== null && (
          <Tag type={isAnemic ? 'red' : 'green'} size="sm" renderIcon={isAnemic ? WarningFilled : CheckmarkFilled}>
            {isAnemic ? t('anemic', 'Anemia') : t('normal', 'Normal')}
          </Tag>
        )}
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
              <StructuredListCell className={styles.label}>{t('lastHb', 'Última Hb')}</StructuredListCell>
              <StructuredListCell className={styles.value}>
                {lastHb !== null ? (
                  <span className={isAnemic ? styles.anemic : styles.normalValue}>{lastHb} g/dL</span>
                ) : (
                  <span className={styles.noData}>{t('noData', 'Sin datos')}</span>
                )}
              </StructuredListCell>
            </StructuredListRow>
            <StructuredListRow>
              <StructuredListCell className={styles.label}>{t('lastDate', 'Fecha')}</StructuredListCell>
              <StructuredListCell className={styles.value}>
                {lastDate ?? <span className={styles.noData}>{t('noData', 'Sin datos')}</span>}
              </StructuredListCell>
            </StructuredListRow>
            <StructuredListRow>
              <StructuredListCell className={styles.label}>{t('nextScreening', 'Próximo tamizaje')}</StructuredListCell>
              <StructuredListCell className={styles.value}>
                {nextDueDate ?? <span className={styles.noData}>{t('pending', 'Pending')}</span>}
              </StructuredListCell>
            </StructuredListRow>
          </StructuredListBody>
        </StructuredListWrapper>
      </div>
    </div>
  );
};

export default AnemiaScreening;
