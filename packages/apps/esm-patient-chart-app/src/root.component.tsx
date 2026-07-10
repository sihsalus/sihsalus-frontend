import { navigate, showSnackbar } from '@openmrs/esm-framework';
import { AppErrorBoundary, RequirePrivilege } from '@sihsalus/esm-rbac';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { basePath, clinicalChartPrivilege, dashboardPath, spaRoot } from './constants';
import PatientChart from './patient-chart/patient-chart.component';
import styles from './root.scss';

function RedirectToHome() {
  const { t } = useTranslation();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (hasRedirected.current) {
      return;
    }

    hasRedirected.current = true;
    showSnackbar({
      kind: 'info',
      isLowContrast: true,
      title: t('chartAccessDeniedTitle', 'Acceso restringido'),
      subtitle: t(
        'chartAccessDeniedMessage',
        'No tiene permisos para acceder a la historia clínica. Fue redirigido al inicio.',
      ),
    });
    navigate({ to: `${globalThis.spaBase}/home/home` });
  }, [t]);

  return null;
}

export default function Root() {
  return (
    <AppErrorBoundary appName="esm-patient-chart-app">
      <RequirePrivilege
        privilege={clinicalChartPrivilege}
        description="Necesita el privilegio de historia clinica para acceder al chart del paciente."
        fallback={<RedirectToHome />}
      >
        <div className={styles.patientChartWrapper}>
          <BrowserRouter basename={spaRoot}>
            <Routes>
              <Route path={basePath} element={<PatientChart />} />
              <Route path={dashboardPath} element={<PatientChart />} />
            </Routes>
          </BrowserRouter>
        </div>
      </RequirePrivilege>
    </AppErrorBoundary>
  );
}

/**
 * DO NOT REMOVE THIS COMMENT
 * THE TRANSLATION KEYS AND VALUES USED IN THE COMMON LIB IS WRITTEN HERE
 * t('paginationPageText', 'of {{count}} pages', {count})
 * t("emptyStateText", 'There are no {{displayText}} to display for this patient', {displayText: "sample text"})
 * t('record', 'Record')
 * t('errorCopy','Sorry, there was a problem displaying this information. You can try to reload this page, or contact the site administrator and quote the error code above.')
 * t('error', 'Error')
 * t('seeAll', 'See all')
 * t('paginationItemsCount', `{{pageItemsCount}} / {{count}} items`, { count: totalItems, pageItemsCount });
 * t('Routine')
 * t('Stat')
 * t('On scheduled date')
 */
