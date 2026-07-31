import { navigate, showSnackbar, useSession } from '@openmrs/esm-framework';
import { useAuditLogger } from '@sihsalus/esm-audit-logger';
import { AppErrorBoundary } from '@sihsalus/esm-rbac';
import { type PropsWithChildren, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { validate as isUuid } from 'uuid';

import { hasClinicalChartAccess } from './clinical-chart-access';
import { basePath, dashboardPath, spaRoot } from './constants';
import PatientChart from './patient-chart/patient-chart.component';
import styles from './root.scss';

function RedirectToPatientSearch() {
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
        'No tiene permisos para acceder a la historia clínica. Fue redirigido a la búsqueda de pacientes.',
      ),
    });
    navigate({ to: `${globalThis.spaBase}/search` });
  }, [t]);

  return null;
}

function RequireClinicalChartAccess({ children }: PropsWithChildren) {
  const session = useSession();
  const logAuditEvent = useAuditLogger();
  const denialAudited = useRef(false);
  const hasAccess = hasClinicalChartAccess(session.user);
  // Capture the chart target during render. The redirect is a child effect and may
  // replace location.pathname before this component's effect records the denial.
  const routePatientUuid = globalThis.location.pathname.match(/\/patient\/([^/]+)\/chart(?:\/|$)/)?.[1];
  const auditedPatientUuid = routePatientUuid && isUuid(routePatientUuid) ? routePatientUuid : undefined;

  useEffect(() => {
    if (!session.authenticated || !session.user || hasAccess || denialAudited.current) return;

    denialAudited.current = true;
    void logAuditEvent({
      eventType: 'PATIENT_CHART_ACCESS_DENIED',
      patientUuid: auditedPatientUuid,
      resourceType: 'Patient',
      metadata: {
        moduleName: '@sihsalus/esm-patient-chart-app',
        outcome: 'denied',
      },
    });
  }, [auditedPatientUuid, hasAccess, logAuditEvent, session.authenticated, session.user]);

  return hasAccess ? <>{children}</> : <RedirectToPatientSearch />;
}

export default function Root() {
  return (
    <AppErrorBoundary appName="esm-patient-chart-app">
      <RequireClinicalChartAccess>
        <div className={styles.patientChartWrapper}>
          <BrowserRouter basename={spaRoot}>
            <Routes>
              <Route path={basePath} element={<PatientChart />} />
              <Route path={dashboardPath} element={<PatientChart />} />
            </Routes>
          </BrowserRouter>
        </div>
      </RequireClinicalChartAccess>
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
