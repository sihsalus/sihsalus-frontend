import { StructuredListSkeleton } from '@carbon/react';
import { formatDatetime, parseDate } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { usePastVisits } from './past-visit.resource';
import styles from './past-visit.scss';
import PastVisitSummary from './past-visit-details/past-visit-summary.component';

interface PastVisitProps {
  patientUuid: string;
}

const PastVisit: React.FC<PastVisitProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const { visits, error, isLoading } = usePastVisits(patientUuid);

  if (isLoading) {
    return <StructuredListSkeleton />;
  }

  if (error) {
    return <p role="alert">{t('unableToLoadPreviousVisit', 'No se pudo cargar la consulta anterior.')}</p>;
  }

  if (visits) {
    return (
      <div className={styles.visitContainer}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h4 className={styles.visitType}>{visits?.visitType?.display}</h4>
            <p className={styles.date}>
              {visits?.startDatetime ? formatDatetime(parseDate(visits.startDatetime)) : '--'}
            </p>
          </div>
          <PastVisitSummary
            encounters={Array.isArray(visits.encounters) ? visits.encounters : []}
            patientUuid={patientUuid}
          />
        </div>
      </div>
    );
  }
  return <p className={styles.bodyLong01}>{t('noPreviousVisitFound', 'No previous visit found')}</p>;
};

export default PastVisit;
