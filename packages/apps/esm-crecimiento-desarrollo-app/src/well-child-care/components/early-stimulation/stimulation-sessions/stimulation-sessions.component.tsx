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
import { credEarlyStimulationEditPrivilege } from '../../../../constants';
import { useCREDFormLauncher } from '../../../../hooks/useCREDFormLauncher';
import { useHasPrivilege } from '../../../../rbac';
import { useStimulationSessions } from '../../../../hooks/useStimulationSessions';

import styles from './stimulation-sessions.scss';

interface StimulationSessionsProps {
  patientUuid: string;
}

const StimulationSessions: React.FC<StimulationSessionsProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const canEdit = useHasPrivilege(credEarlyStimulationEditPrivilege);
  const { totalSessions, lastSessionDate, developmentAreas, isLoading, error } = useStimulationSessions(patientUuid);
  const { launchForm: handleAdd, isLoading: isFormLoading } = useCREDFormLauncher('stimulationSessionForm');
  const headerTitle = t('esSessionsTitle', 'Sesiones de estimulación');

  if (isLoading) {
    return <DataTableSkeleton size="sm" rowCount={3} columnCount={2} />;
  }

  if (error) {
    return <ErrorState error={error} headerTitle={headerTitle} />;
  }

  return (
    <div className={styles.widgetCard}>
      <CardHeader title={headerTitle}>
        <Tag type={totalSessions ? 'blue' : 'gray'} size="sm">
          {totalSessions ? `${totalSessions} ${t('sessions', 'sesiones')}` : t('noData', 'Sin datos')}
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
                {t('esSessionsCompleted', 'Sesiones realizadas')}
              </StructuredListCell>
              <StructuredListCell className={styles.value}>
                {totalSessions ?? <span className={styles.noData}>{t('noData', 'Sin datos')}</span>}
              </StructuredListCell>
            </StructuredListRow>
            <StructuredListRow>
              <StructuredListCell className={styles.label}>
                {t('esDevelopmentAreas', 'Áreas de desarrollo')}
              </StructuredListCell>
              <StructuredListCell className={styles.value}>
                {developmentAreas ?? <span className={styles.noData}>{t('noData', 'Sin datos')}</span>}
              </StructuredListCell>
            </StructuredListRow>
            <StructuredListRow>
              <StructuredListCell className={styles.label}>{t('lastSession', 'Última sesión')}</StructuredListCell>
              <StructuredListCell className={styles.value}>
                {lastSessionDate ?? <span className={styles.noData}>{t('noData', 'Sin datos')}</span>}
              </StructuredListCell>
            </StructuredListRow>
          </StructuredListBody>
        </StructuredListWrapper>
      </div>
    </div>
  );
};

export default StimulationSessions;
