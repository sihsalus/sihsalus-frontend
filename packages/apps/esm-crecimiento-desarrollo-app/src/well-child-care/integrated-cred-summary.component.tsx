import { Button, InlineLoading, Tile } from '@carbon/react';
import { ArrowRight } from '@carbon/react/icons';
import { formatDate } from '@openmrs/esm-framework';
import { ErrorState } from '@openmrs/esm-patient-common-lib';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { credWellChildPrivilege } from '../constants';
import useEncountersCRED from '../hooks/useEncountersCRED';
import { groupCREDControlEncounters } from '../hooks/useCREDSchedule';
import styles from './integrated-cred-dashboard.scss';
import { type IntegratedCredSectionId, integratedCredSections } from './integrated-cred-tabs';

function RecentCREDRecords({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation('@sihsalus/esm-cred-app');
  const { encounters, isLoading, error, controlNumberError } = useEncountersCRED(patientUuid);
  const recentRecords = useMemo(
    () =>
      groupCREDControlEncounters(encounters ?? [])
        .filter(({ encounterDatetime }) => encounterDatetime && Number.isFinite(Date.parse(encounterDatetime)))
        .sort((first, second) => Date.parse(second.encounterDatetime ?? '') - Date.parse(first.encounterDatetime ?? ''))
        .slice(0, 3),
    [encounters],
  );
  const title = t('credRecentRecords', 'Atenciones CRED registradas');

  if (isLoading) return <InlineLoading description={t('credLoadingRecords', 'Cargando atenciones registradas…')} />;
  if (error) return <ErrorState error={error} headerTitle={title} />;

  return (
    <Tile>
      <h5>{title}</h5>
      {recentRecords.length ? (
        <ol className={styles.recordList}>
          {recentRecords.map(({ uuid, encounterDatetime, controlNumber }) => (
            <li className={styles.record} key={uuid}>
              {formatDate(new Date(encounterDatetime ?? ''), { time: true })}
              {!controlNumberError && controlNumber !== undefined && (
                <>
                  {' '}
                  —{' '}
                  {t('credRecordedControlNumber', 'Control {{number}}', {
                    number: controlNumber,
                  })}
                </>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.description}>{t('credNoRecordedControls', 'No hay atenciones CRED registradas.')}</p>
      )}
    </Tile>
  );
}

interface IntegratedCredSummaryProps {
  patientUuid: string;
  sections: Array<(typeof integratedCredSections)[number]>;
  onNavigate: (id: IntegratedCredSectionId) => void;
}

export default function IntegratedCredSummary({ patientUuid, sections, onNavigate }: IntegratedCredSummaryProps) {
  const { t } = useTranslation('@sihsalus/esm-cred-app');

  return (
    <div className={styles.panel}>
      <RequirePrivilege privilege={credWellChildPrivilege} hideUnauthorized>
        <RecentCREDRecords patientUuid={patientUuid} />
      </RequirePrivilege>
      <div className={styles.sectionCards}>
        {sections.map(({ id, labelKey, descriptionKey, icon: Icon }) => (
          <Tile className={styles.sectionCard} key={id}>
            <div className={styles.sectionHeading}>
              <Icon aria-hidden="true" />
              <h5>{t(labelKey)}</h5>
            </div>
            <p className={styles.description}>{t(descriptionKey)}</p>
            <Button kind="ghost" size="sm" renderIcon={ArrowRight} onClick={() => onNavigate(id)}>
              {t('credOpenSection', 'Abrir {{section}}', {
                section: t(labelKey),
              })}
            </Button>
          </Tile>
        ))}
      </div>
    </div>
  );
}
