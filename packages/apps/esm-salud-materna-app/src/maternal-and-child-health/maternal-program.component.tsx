import { Button, Tile } from '@carbon/react';
import {
  Calendar,
  ChartLine,
  DocumentMultiple_01,
  Education,
  HealthCross,
  ReminderMedical,
  Task,
  Time,
  UserFollow,
} from '@carbon/react/icons';
import { BabyIcon, formatDate, navigate, usePatient, userHasAccess, useSession } from '@openmrs/esm-framework';
import {
  createClinicalDashboardLink,
  ErrorState,
  evaluateShowWhenExpression,
  TabbedDashboard,
  type TabConfig,
  usePatientEnrollment,
  useLaunchWorkspaceRequiringVisit,
} from '@openmrs/esm-patient-common-lib';
import { UnauthorizedState } from '@sihsalus/esm-rbac';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useCurrentPregnancy } from '../hooks/useCurrentPregnancy';
import { usePrenatalMeasurements } from '../hooks/usePrenatalMeasurements';
import { maternalHealthFormsWorkspace } from '../types';
import AlturaCuelloOverview from '../ui/alturaCuello-chart/altura-cuello-overview.component';
import BirthPlanWidget from './components/prenatal-care/birth-plan/birth-plan.component';
import CurrentPregnancyTable from './components/prenatal-care/currentPregnancy.component';
import PrenatalSupplementationWidget from './components/prenatal-care/prenatal-supplementation/prenatal-supplementation.component';
import PrenatalCareChart from './components/prenatal-care/prenatalCareChart.component';
import PsychoprophylaxisWidget from './components/prenatal-care/psychoprophylaxis/psychoprophylaxis.component';
import RiskClassification from './components/prenatal-care/risk-classification/risk-classification.component';
import { integratedMaternalDashboardMeta, maternalAndChildHealthNavGroup } from './dashboard.meta';
import { LabourDelivery } from './labour-delivery.component';
import MaternalFormHistory from './maternal-form-history.component';
import styles from './maternal-program.scss';
import { canRegisterMaternalForm, canViewMaternalProgram } from './maternal-program-access';

const namespace = '@sihsalus/esm-salud-materna-app';
const screeningForms = [
  'screeningIndicatorsForm',
  'perinatalMentalHealthForm',
  'maternalViolenceScreeningForm',
] as const;
const postpartumForms = ['immediatePostpartumPeriod', 'postpartumControl', 'maternalReadmissionForm'] as const;
const dischargeForms = ['maternalDischargeForm', 'maternalEpicrisisForm'] as const;

const hcmpSections = [
  { titleKey: 'hcmpBaseline', icon: UserFollow, tabIds: ['antecedents', 'pregnancy'] },
  { titleKey: 'hcmpPrenatal', icon: ChartLine, tabIds: ['control', 'screening', 'plan'] },
  { titleKey: 'hcmpDeliveryPostpartum', icon: BabyIcon, tabIds: ['delivery', 'postpartum'] },
  { titleKey: 'hcmpDischarge', icon: DocumentMultiple_01, tabIds: ['discharge'] },
] as const;
const DirectLink = createClinicalDashboardLink({
  ...integratedMaternalDashboardMeta,
  showWhenExpression: maternalAndChildHealthNavGroup.showWhenExpression,
});

export const IntegratedMaternalLink: React.FC<{ basePath: string }> = (props) => {
  const session = useSession();
  return canViewMaternalProgram(session) ? <DirectLink {...props} /> : null;
};

const MaternalEpisodeSummary: React.FC<{ patientUuid: string }> = ({ patientUuid }) => {
  const { t } = useTranslation(namespace);
  const pregnancy = useCurrentPregnancy(patientUuid);
  const measurements = usePrenatalMeasurements(patientUuid);
  const error = pregnancy.error ?? measurements.error;
  if (error) return <ErrorState headerTitle={t('maternalOverview')} error={error} />;
  if (pregnancy.isLoading || measurements.isLoading) return <p role="status">{t('loadingData')}</p>;
  const latest = measurements.data[0];
  return (
    <div className={styles.recordGrid}>
      <Tile>
        <div className={styles.recordHeading}>
          <Calendar size={24} aria-hidden="true" />
          <h5>{t('maternalPregnancyRecord')}</h5>
        </div>
        <p>
          {pregnancy.currentPregnancyEncounter
            ? formatDate(new Date(pregnancy.currentPregnancyEncounter.encounterDatetime))
            : t('maternalNoRecordedForms')}
        </p>
      </Tile>
      <Tile>
        <div className={styles.recordHeading}>
          <ChartLine size={24} aria-hidden="true" />
          <h5>{t('maternalLatestMeasurement')}</h5>
        </div>
        <p>{latest ? formatDate(new Date(latest.date)) : t('maternalNoRecordedForms')}</p>
        {latest ? <p>{t('maternalRecordedWeek', { week: latest.gestationalWeek })}</p> : null}
      </Tile>
    </div>
  );
};

interface Props {
  patient: fhir.Patient;
  patientUuid: string;
}

const MaternalProgram: React.FC<Props> = ({ patient, patientUuid }) => {
  const { t } = useTranslation(namespace);
  const session = useSession();
  const [selectedTabId, setSelectedTabId] = useState('overview');
  const launchForms = useLaunchWorkspaceRequiringVisit(patientUuid, maternalHealthFormsWorkspace);
  const canRead = (privilege: string) => Boolean(session?.user && userHasAccess(privilege, session.user));
  const prenatal = canRead('app:hoja.clinica.controlPrenatal');
  const postpartum = canRead('app:hoja.clinica.atencionPostnatal');
  const delivery = canRead('app:hoja.clinica.partoPuerperio');
  const panel = (content: React.ReactNode) => <div className={styles.panel}>{content}</div>;
  const tabs: TabConfig[] = [
    { id: 'overview', labelKey: 'maternalOverview', icon: HealthCross, content: null },
    ...(prenatal
      ? [
          {
            id: 'antecedents',
            labelKey: 'maternalAntecedentsTab',
            icon: UserFollow,
            slotName: 'prenatal-maternal-history-slot',
          },
          {
            id: 'pregnancy',
            labelKey: 'currentPregnancy',
            icon: Calendar,
            content: panel(
              <>
                <CurrentPregnancyTable patientUuid={patientUuid} />
                <RiskClassification patientUuid={patientUuid} />
              </>,
            ),
          },
          {
            id: 'control',
            labelKey: 'maternalPrenatalTab',
            icon: ChartLine,
            content: panel(
              <>
                <PrenatalCareChart patientUuid={patientUuid} />
                <AlturaCuelloOverview patient={patient} patientUuid={patientUuid} />
              </>,
            ),
          },
          {
            id: 'screening',
            labelKey: 'maternalScreeningTab',
            icon: Task,
            content: panel(
              <MaternalFormHistory
                patientUuid={patientUuid}
                formKeys={screeningForms}
                titleKey="maternalScreeningTab"
              />,
            ),
          },
          {
            id: 'plan',
            labelKey: 'maternalPlanTab',
            icon: Education,
            content: panel(
              <>
                <BirthPlanWidget patientUuid={patientUuid} />
                <PrenatalSupplementationWidget patientUuid={patientUuid} />
                <PsychoprophylaxisWidget patientUuid={patientUuid} />
              </>,
            ),
          },
        ]
      : []),
    ...(delivery
      ? [
          {
            id: 'delivery',
            labelKey: 'maternalDeliveryTab',
            icon: BabyIcon,
            content: panel(<LabourDelivery patient={patient} patientUuid={patientUuid} />),
          },
        ]
      : []),
    ...(postpartum
      ? [
          {
            id: 'postpartum',
            labelKey: 'maternalPostpartumTab',
            icon: ReminderMedical,
            content: panel(
              <MaternalFormHistory
                patientUuid={patientUuid}
                formKeys={postpartumForms}
                titleKey="maternalPostpartumTab"
              />,
            ),
          },
          {
            id: 'discharge',
            labelKey: 'maternalDischargeTab',
            icon: DocumentMultiple_01,
            content: panel(
              <MaternalFormHistory
                patientUuid={patientUuid}
                formKeys={dischargeForms}
                titleKey="maternalDischargeTab"
              />,
            ),
          },
        ]
      : []),
  ];

  const related = [
    { privilege: 'app:hoja.clinica.planificacionFamiliar', path: 'family-planning-dashboard', label: 'familyPlanning' },
    { privilege: 'app:hoja.clinica.prevencionCancer', path: 'cancer-prevention-dashboard', label: 'cancerPrevention' },
  ].filter(({ privilege }) => canRead(privilege));

  tabs[0] = {
    id: 'overview',
    labelKey: 'maternalOverview',
    icon: HealthCross,
    content: panel(
      <>
        <p className={styles.help}>{t('maternalOverviewHelp')}</p>
        {prenatal ? <MaternalEpisodeSummary patientUuid={patientUuid} /> : null}
        <div className={styles.overviewGrid}>
          {hcmpSections.map(({ titleKey, icon: Icon, tabIds }) => {
            const sectionTabs = tabs.filter(({ id }) => tabIds.some((tabId) => tabId === id));
            return sectionTabs.length ? (
              <section className={styles.stage} key={titleKey} aria-label={t(titleKey)}>
                <div className={styles.recordHeading}>
                  <Icon size={24} aria-hidden="true" />
                  <h5>{t(titleKey)}</h5>
                </div>
                {sectionTabs.map(({ id, labelKey }) => (
                  <button
                    className={styles.stageLink}
                    type="button"
                    key={id}
                    onClick={() => setSelectedTabId(id ?? 'overview')}
                  >
                    {t(labelKey)}
                  </button>
                ))}
              </section>
            ) : null;
          })}
        </div>
        {related.length ? (
          <section>
            <h5>{t('maternalRelatedCare')}</h5>
            <div className={styles.relatedLinks}>
              {related.map(({ path, label }) => (
                <Button
                  key={path}
                  size="sm"
                  kind="tertiary"
                  onClick={() => navigate({ to: `\${openmrsSpaBase}/patient/${patientUuid}/chart/${path}` })}
                >
                  {t(label)}
                </Button>
              ))}
            </div>
          </section>
        ) : null}
      </>,
    ),
  };

  return (
    <TabbedDashboard
      patient={patient}
      patientUuid={patientUuid}
      titleKey="Gestantes"
      descriptionKey="maternalProgramDescription"
      ariaLabelKey="maternalProgramTabs"
      translationNamespace={namespace}
      tabs={tabs}
      selectedTabId={selectedTabId}
      onTabChange={setSelectedTabId}
      mountActiveTabOnly
      headerActions={
        <>
          {canRead('app:hoja.clinica.visitas') ? (
            <Button
              kind="tertiary"
              size="sm"
              renderIcon={Time}
              onClick={() => navigate({ to: `\${openmrsSpaBase}/patient/${patientUuid}/chart/Visits` })}
            >
              {t('maternalPreviousVisits')}
            </Button>
          ) : null}
          {canRegisterMaternalForm(session) ? (
            <Button size="sm" renderIcon={DocumentMultiple_01} onClick={() => launchForms({ patientUuid })}>
              {t('maternalHealthForms')}
            </Button>
          ) : null}
        </>
      }
    />
  );
};

const VisibleMaternalProgram: React.FC<Props> = (props) => {
  const { activePatientEnrollment, isLoading, error } = usePatientEnrollment(props.patientUuid);
  const { t } = useTranslation(namespace);
  if (error) return <ErrorState headerTitle={t('Gestantes')} error={error} />;
  if (
    isLoading ||
    !evaluateShowWhenExpression(
      maternalAndChildHealthNavGroup.showWhenExpression,
      props.patient,
      activePatientEnrollment,
    )
  )
    return null;
  return <MaternalProgram key={props.patientUuid} {...props} />;
};

export const IntegratedMaternalDashboard: React.FC<Partial<Props>> = ({
  patient: patientProp,
  patientUuid: uuidProp,
}) => {
  const session = useSession();
  const { patient: hookPatient, patientUuid: hookUuid } = usePatient();
  const patient = patientProp ?? hookPatient;
  const patientUuid = uuidProp ?? hookUuid;
  if (!canViewMaternalProgram(session)) return <UnauthorizedState privilege="app:hoja.clinica" />;
  return patient && patientUuid && patient.id === patientUuid ? (
    <VisibleMaternalProgram patient={patient} patientUuid={patientUuid} />
  ) : null;
};
