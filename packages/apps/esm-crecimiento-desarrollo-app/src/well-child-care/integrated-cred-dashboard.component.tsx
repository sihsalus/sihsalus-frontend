import { Button, InlineLoading, InlineNotification } from '@carbon/react';
import { ArrowRight, DocumentMultiple_01, Report, Time } from '@carbon/react/icons';
import { ExtensionSlot, navigate, userHasAccess, usePatient, useSession } from '@openmrs/esm-framework';
import {
  ErrorState,
  evaluateShowWhenExpression,
  type TabConfig,
  TabbedDashboard,
  useLaunchWorkspaceRequiringVisit,
  usePatientEnrollment,
} from '@openmrs/esm-patient-common-lib';
import { RequirePrivilege, UnauthorizedState } from '@sihsalus/esm-rbac';
import React, { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  credAntecedentsPrivilege,
  credCourseLifeEditPrivilege,
  credCourseLifePrivilege,
  credEarlyStimulationPrivilege,
  credImmunizationPrivilege,
  credNeonatalPrivilege,
  credNutritionPrivilege,
  credWellChildPrivilege,
} from '../constants';
import { neonatalCareDashboardMeta, wellChildCareNavGroup } from '../dashboard.meta';
import ChildMedicalHistory from '../ui/conditions-filter/conditions-overview.component';
import AnemiaScreening from './components/anemia-screening/anemia-screening.component';
import CredControlsMatrix from './components/cred-controls-timeline/cred-matrix.component';
import PregnancyBirthTable from './components/neonatal-register/detalles-embarazo/pregnancy-table.component';
import BirthDataTable from './components/neonatal-register/detalles-nacimiento/birth-date.component';
import ScreeningIndicators from './components/screening/screening-indicators.component';
import SupplementationTracker from './components/supplementation/supplementation-tracker.component';
import styles from './integrated-cred-dashboard.scss';
import IntegratedCredSummary from './integrated-cred-summary.component';
import { canReadIntegratedCred, type IntegratedCredSectionId, integratedCredSections } from './integrated-cred-tabs';

const translationNamespace = '@sihsalus/esm-cred-app';
const patientVisitsPrivilege = 'app:hoja.clinica.visitas';
const GrowthChartOverview = lazy(() => import('../ui/growth-chart/growth-chart-overview.component'));

interface IntegratedCredDashboardProps {
  patient?: fhir.Patient | null;
  patientUuid?: string | null;
}

function IntegratedCredPatientDashboard({ patient, patientUuid }: { patient: fhir.Patient; patientUuid: string }) {
  const { t } = useTranslation(translationNamespace);
  const session = useSession();
  const [selectedTabId, setSelectedTabId] = useState('overview');
  const canRead = (privilege: string) => userHasAccess(privilege, session?.user);
  const sections = integratedCredSections.filter(({ readPrivileges }) => readPrivileges.some(canRead));
  const launchControl = useLaunchWorkspaceRequiringVisit<{
    patientUuid: string;
  }>(patientUuid, 'wellchild-control-form');
  const state = { patient, patientUuid };
  const panelContents: Record<IntegratedCredSectionId, React.ReactNode> = {
    antecedents: (
      <div className={styles.panel}>
        <RequirePrivilege privilege={credAntecedentsPrivilege} hideUnauthorized>
          <ChildMedicalHistory patientUuid={patientUuid} />
        </RequirePrivilege>
        <RequirePrivilege privilege={credNeonatalPrivilege} hideUnauthorized>
          <Button
            className={styles.formAction}
            kind="ghost"
            renderIcon={ArrowRight}
            onClick={() =>
              navigate({
                to: `${window.getOpenmrsSpaBase()}patient/${patientUuid}/chart/${neonatalCareDashboardMeta.path}`,
              })
            }
          >
            {t('credViewNeonatalCare')}
          </Button>
          <BirthDataTable patientUuid={patientUuid} />
          <PregnancyBirthTable patientUuid={patientUuid} />
        </RequirePrivilege>
      </div>
    ),
    control: (
      <RequirePrivilege privilege={credWellChildPrivilege}>
        <div className={styles.panel}>
          <p className={styles.description}>{t('credControlInstructions')}</p>
          <RequirePrivilege privilege={credCourseLifeEditPrivilege} hideUnauthorized>
            <Button
              className={styles.formAction}
              kind="tertiary"
              renderIcon={DocumentMultiple_01}
              onClick={() => launchControl({ patientUuid })}
            >
              {t('credOpenControlForms')}
            </Button>
          </RequirePrivilege>
          <CredControlsMatrix patientUuid={patientUuid} />
        </div>
      </RequirePrivilege>
    ),
    growth: (
      <div className={styles.panel}>
        {(canRead(credWellChildPrivilege) || canRead(credNeonatalPrivilege)) && (
          <>
            <Suspense fallback={<InlineLoading description={t('credLoadingGrowth')} />}>
              <GrowthChartOverview patient={patient} patientUuid={patientUuid} />
            </Suspense>
            <p className={styles.description}>{t('credGrowthReference')}</p>
          </>
        )}
        <RequirePrivilege privilege={credNutritionPrivilege} hideUnauthorized>
          <ExtensionSlot name="child-nutrition-assessment-slot" state={state} />
          <ExtensionSlot name="child-nutrition-counseling-slot" state={state} />
          <AnemiaScreening patientUuid={patientUuid} />
          <SupplementationTracker patientUuid={patientUuid} />
          <ScreeningIndicators patientUuid={patientUuid} />
        </RequirePrivilege>
      </div>
    ),
    development: (
      <RequirePrivilege privilege={credEarlyStimulationPrivilege}>
        <div className={styles.panel}>
          <ExtensionSlot name="cred-development-slot" state={state} />
          <ExtensionSlot name="early-stimulation-sessions-slot" state={state} />
          <ExtensionSlot name="early-stimulation-counseling-slot" state={state} />
        </div>
      </RequirePrivilege>
    ),
    immunization: (
      <RequirePrivilege privilege={credImmunizationPrivilege}>
        <div className={styles.panel}>
          <ExtensionSlot name="vaccination-schedule-slot" state={state} />
          <ExtensionSlot name="vaccination-appointment-slot" state={state} />
        </div>
      </RequirePrivilege>
    ),
    followup: (
      <div className={styles.panel}>
        <RequirePrivilege privilege={credWellChildPrivilege} hideUnauthorized>
          <ExtensionSlot name="cred-schedule-slot" state={state} />
        </RequirePrivilege>
        <RequirePrivilege privilege={credNutritionPrivilege} hideUnauthorized>
          <ExtensionSlot name="child-nutrition-followup-slot" state={state} />
        </RequirePrivilege>
        <RequirePrivilege privilege={credEarlyStimulationPrivilege} hideUnauthorized>
          <ExtensionSlot name="early-stimulation-followup-slot" state={state} />
        </RequirePrivilege>
      </div>
    ),
  };
  const tabs: TabConfig[] = [
    {
      id: 'overview',
      labelKey: 'credOverviewTab',
      icon: Report,
      content: <IntegratedCredSummary patientUuid={patientUuid} sections={sections} onNavigate={setSelectedTabId} />,
    },
    ...sections.map(({ id, labelKey, icon }) => ({
      id,
      labelKey,
      icon,
      content: panelContents[id],
    })),
  ];

  return (
    <TabbedDashboard
      patient={patient}
      patientUuid={patientUuid}
      titleKey="CRED"
      descriptionKey="credDashboardDescription"
      tabs={tabs}
      ariaLabelKey="credIntegratedTabs"
      translationNamespace={translationNamespace}
      selectedTabId={tabs.some(({ id }) => id === selectedTabId) ? selectedTabId : 'overview'}
      onTabChange={setSelectedTabId}
      mountActiveTabOnly
      headerActions={
        <div className={styles.actions}>
          <RequirePrivilege privilege={credCourseLifeEditPrivilege} hideUnauthorized>
            <Button
              kind="tertiary"
              size="sm"
              renderIcon={DocumentMultiple_01}
              onClick={() => launchControl({ patientUuid })}
            >
              {t('credOpenControlForms')}
            </Button>
          </RequirePrivilege>
          <RequirePrivilege privilege={patientVisitsPrivilege} hideUnauthorized>
            <Button
              kind="ghost"
              size="sm"
              renderIcon={Time}
              onClick={() => navigate({ to: `${window.getOpenmrsSpaBase()}patient/${patientUuid}/chart/Visits` })}
            >
              {t('credPreviousConsultations')}
            </Button>
          </RequirePrivilege>
        </div>
      }
    />
  );
}

function EnrolledCredDashboard({ patient, patientUuid }: { patient: fhir.Patient; patientUuid: string }) {
  const { t } = useTranslation(translationNamespace);
  const { activePatientEnrollment, isLoading, error } = usePatientEnrollment(patientUuid);

  if (isLoading) return <InlineLoading description={t('credLoadingProgram')} />;
  if (error) return <ErrorState error={error} headerTitle={t('CRED')} />;
  if (!evaluateShowWhenExpression(wellChildCareNavGroup.showWhenExpression, patient, activePatientEnrollment)) {
    return (
      <InlineNotification
        kind="info"
        lowContrast
        hideCloseButton
        title={t('credProgramNotActive')}
        subtitle={t('credProgramNotActiveDescription')}
      />
    );
  }

  return <IntegratedCredPatientDashboard patient={patient} patientUuid={patientUuid} />;
}

export default function IntegratedCredDashboard({
  patient: patientProp,
  patientUuid: patientUuidProp,
}: IntegratedCredDashboardProps) {
  const { patient: hookPatient, patientUuid: hookPatientUuid } = usePatient(patientUuidProp ?? undefined);
  const session = useSession();
  const patient = patientProp ?? hookPatient;
  const patientUuid = patientUuidProp ?? hookPatientUuid;
  if (!patient || !patientUuid || patient.id !== patientUuid) return null;
  if (!canReadIntegratedCred(session)) return <UnauthorizedState privilege={credCourseLifePrivilege} />;

  return <EnrolledCredDashboard key={patientUuid} patient={patient} patientUuid={patientUuid} />;
}
