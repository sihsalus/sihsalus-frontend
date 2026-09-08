import { ConfigurableLink, useConfig } from '@openmrs/esm-framework';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import { useTranslation } from 'react-i18next';

import { RecentPatientResults } from '../compact-patient-search/recently-searched-patients.component';
import type { PatientSearchConfig } from '../config-schema';
import { patientChartPrivilege } from '../patient-chart-access';
import { PatientSearchContext } from '../patient-search-context';
import { useRestPatients } from '../patient-search.resource';
import { useRecentlyViewedPatients } from '../recently-viewed-patients.store';

import styles from './recent-patients-page.scss';

function RecentPatientList() {
  const { recentlyViewedPatientUuids } = useRecentlyViewedPatients(true);
  const response = useRestPatients(recentlyViewedPatientUuids);
  return (
    <PatientSearchContext.Provider value={{}}>
      <RecentPatientResults {...response} standalone />
    </PatientSearchContext.Provider>
  );
}

export default function RecentPatientsPage() {
  const { t } = useTranslation();
  const config = useConfig<PatientSearchConfig>();

  return (
    <RequirePrivilege
      privilege={patientChartPrivilege}
      description={t('recentPatientsAccessDenied', 'You need patient chart access to view recent patients.')}
    >
      <main className={`omrs-main-content ${styles.page}`} aria-labelledby="recent-patients-title">
        <header className={styles.header}>
          <h1 id="recent-patients-title">{t('recentlyViewedPatients', 'Recently viewed patients')}</h1>
          <ConfigurableLink to="${openmrsSpaBase}/search">{t('searchPatient', 'Search patient')}</ConfigurableLink>
        </header>
        {config.search.showRecentlySearchedPatients ? (
          <>
            <p className={styles.description}>
              {t(
                'recentlyViewedPatientsHelp',
                'The last 10 patient charts opened in this tab, from any entry point. Reopen a chart while waiting for results.',
              )}
            </p>
            <RecentPatientList />
          </>
        ) : (
          <p className={styles.description}>
            {t(
              'recentPatientsDisabled',
              'Recent patients are disabled in this installation. You can still search for a patient.',
            )}
          </p>
        )}
      </main>
    </RequirePrivilege>
  );
}
