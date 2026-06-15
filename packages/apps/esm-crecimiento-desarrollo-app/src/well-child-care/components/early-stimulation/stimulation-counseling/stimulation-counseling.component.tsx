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
import { credEarlyStimulationEditPrivilege } from '../../../../constants';
import { useCREDFormLauncher } from '../../../../hooks/useCREDFormLauncher';
import { useStimulationCounseling } from '../../../../hooks/useStimulationCounseling';

import styles from './stimulation-counseling.scss';

interface StimulationCounselingProps {
  patientUuid: string;
}

const StimulationCounseling: React.FC<StimulationCounselingProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const session = useSession();
  const canEdit = userHasAccess(credEarlyStimulationEditPrivilege, session?.user);
  const { totalSessions, lastCounselingDate, lastCounselingResult, isLoading, error } =
    useStimulationCounseling(patientUuid);
  const { launchForm: handleAdd, isLoading: isFormLoading } = useCREDFormLauncher('stimulationCounselingForm');
  const headerTitle = t('esCounselingTitle', 'Consejería a padres');

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
                {t('esCounselingSessions', 'Sesiones de consejería')}
              </StructuredListCell>
              <StructuredListCell className={styles.value}>
                {totalSessions ?? <span className={styles.noData}>{t('noData', 'Sin datos')}</span>}
              </StructuredListCell>
            </StructuredListRow>
            <StructuredListRow>
              <StructuredListCell className={styles.label}>
                {t('esLastCounselingResult', 'Último resultado')}
              </StructuredListCell>
              <StructuredListCell className={styles.value}>
                {lastCounselingResult ?? <span className={styles.noData}>{t('noData', 'Sin datos')}</span>}
              </StructuredListCell>
            </StructuredListRow>
            <StructuredListRow>
              <StructuredListCell className={styles.label}>{t('lastSession', 'Última sesión')}</StructuredListCell>
              <StructuredListCell className={styles.value}>
                {lastCounselingDate ?? <span className={styles.noData}>{t('noData', 'Sin datos')}</span>}
              </StructuredListCell>
            </StructuredListRow>
          </StructuredListBody>
        </StructuredListWrapper>
      </div>
    </div>
  );
};

export default StimulationCounseling;
