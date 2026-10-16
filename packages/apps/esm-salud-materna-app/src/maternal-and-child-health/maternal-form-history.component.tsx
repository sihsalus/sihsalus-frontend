import { DataTableSkeleton, Tile } from '@carbon/react';
import { Document } from '@carbon/react/icons';
import { formatDate, openmrsFetch, restBaseUrl, useConfig, useOpenmrsFetchAll } from '@openmrs/esm-framework';
import { ErrorState } from '@openmrs/esm-patient-common-lib';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { ConfigObject } from '../config-schema';
import { encounterMatchesForm, type MaternalEncounter } from '../utils/pregnancy-episode-utils';
import { formLabels, type MaternalFormKey } from './maternal-forms';
import styles from './maternal-program.scss';

interface Props {
  patientUuid: string;
  formKeys: ReadonlyArray<MaternalFormKey>;
  titleKey: string;
}

/** Recorded forms and dates only; a saved encounter does not establish clinical completion. */
const MaternalFormHistory: React.FC<Props> = ({ patientUuid, formKeys, titleKey }) => {
  const { t } = useTranslation('@sihsalus/esm-salud-materna-app');
  const config = useConfig<ConfigObject>();
  const { data, isLoading, error } = useOpenmrsFetchAll<MaternalEncounter>(
    patientUuid
      ? `${restBaseUrl}/encounter?patient=${patientUuid}&v=custom:(uuid,encounterDatetime,form:(uuid,name,display))`
      : null,
    { fetcher: openmrsFetch },
  );

  if (error) return <ErrorState error={error} headerTitle={t(titleKey)} />;
  if (isLoading) return <DataTableSkeleton role="progressbar" aria-label={t('loadingData')} />;

  return (
    <section aria-label={t(titleKey)}>
      <h5 className={styles.sectionTitle}>{t(titleKey)}</h5>
      <p className={styles.help}>{t('maternalRecordDatesHelp')}</p>
      <div className={styles.recordGrid}>
        {formKeys.map((key) => {
          const identifier = config.formsList[key]?.trim();
          const records = (data ?? [])
            .filter((encounter) => encounterMatchesForm(encounter, identifier))
            .sort((a, b) => Date.parse(b.encounterDatetime) - Date.parse(a.encounterDatetime));
          return (
            <Tile key={key}>
              <div className={styles.recordHeading}>
                <Document size={20} aria-hidden="true" />
                <h6>{t(`maternalForm_${key}`, formLabels[key] ?? key)}</h6>
              </div>
              {!identifier ? (
                <p>{t('maternalFormNotConfigured')}</p>
              ) : records.length ? (
                <ul className={styles.recordDates}>
                  {records.map((record) => (
                    <li key={record.uuid}>{formatDate(new Date(record.encounterDatetime))}</li>
                  ))}
                </ul>
              ) : (
                <p>{t('maternalNoRecordedForms')}</p>
              )}
            </Tile>
          );
        })}
      </div>
    </section>
  );
};

export default MaternalFormHistory;
