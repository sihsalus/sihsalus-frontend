import { Button, Layer, Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import {
  Activity,
  ArrowRight,
  Catalog,
  DocumentMultiple_01,
  ListChecked,
  Microscope,
  ReminderMedical,
  Time,
} from '@carbon/react/icons';
import { ExtensionSlot, navigate } from '@openmrs/esm-framework';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { consultaExternaPrivilege, patientVisitsPrivilege } from '../utils/constants';
import Anamnesis from './anamnesis.component';
import ConsultaExternaAntecedents from './consulta-externa-antecedents.component';
import styles from './consulta-externa-dashboard.scss';
import { type ConsultaExternaTabId, getConsultaExternaTabIndex } from './consulta-externa-tabs';
import DiagnosticoClasificado from './diagnostico-clasificado.component';
import ExamenFisico from './notas-soap.component';
import OutpatientVisitSummaryDownload from './outpatient-visit-summary-download.component';
import PlanTratamiento from './plan-tratamiento.component';
import ReferenciaContraReferencia from './referencia-contrarreferencia.component';
import SisFinancingWarning from './sis-financing-warning.component';

interface ConsultaExternaDashboardProps {
  patientUuid: string;
}

const ConsultaExternaDashboard: React.FC<ConsultaExternaDashboardProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const [selectedTab, setSelectedTab] = useState(0);

  const handleNavigateToTab = useCallback((tabId: ConsultaExternaTabId) => {
    setSelectedTab(getConsultaExternaTabIndex(tabId));
  }, []);

  return (
    <RequirePrivilege privilege={consultaExternaPrivilege}>
      <div>
        <SisFinancingWarning patientUuid={patientUuid} />
        <header className={styles.dashboardHeader}>
          <h1 className={styles.dashboardHeading}>{t('consultaExterna', 'Consulta Externa')}</h1>
          <div className={styles.dashboardActions}>
            <RequirePrivilege privilege={patientVisitsPrivilege} hideUnauthorized>
              <Button
                kind="ghost"
                size="sm"
                renderIcon={Time}
                onClick={() =>
                  navigate({
                    to: `\${openmrsSpaBase}/patient/${patientUuid}/chart/Visits`,
                  })
                }
              >
                {t('previousConsultations', 'Previous consultations')}
              </Button>
            </RequirePrivilege>
            <OutpatientVisitSummaryDownload patientUuid={patientUuid} onNavigateToTab={handleNavigateToTab} />
          </div>
        </header>
        <Layer className={styles.tabsContainer}>
          <Tabs selectedIndex={selectedTab} onChange={({ selectedIndex }) => setSelectedTab(selectedIndex)}>
            <TabList contained activation="manual" aria-label={t('consultaExternaTabs', 'Consulta Externa tabs')}>
              <Tab renderIcon={Activity}>{t('triageAndChiefComplaint', 'Triajes previos')}</Tab>
              <Tab renderIcon={ReminderMedical}>{t('antecedents', 'Antecedents')}</Tab>
              <Tab renderIcon={DocumentMultiple_01}>{t('anamnesis', 'Anamnesis')}</Tab>
              <Tab renderIcon={DocumentMultiple_01}>{t('physicalExam', 'Examen físico')}</Tab>
              <Tab renderIcon={Microscope}>{t('complementaryTests', 'Pruebas complementarias')}</Tab>
              <Tab renderIcon={Catalog}>{t('diagnosisClassification', 'Diagnóstico')}</Tab>
              <Tab renderIcon={ListChecked}>{t('treatmentPlan', 'Plan de Tratamiento')}</Tab>
              <Tab renderIcon={ArrowRight}>{t('referralCounterReferral', 'Referencia / Contrarreferencia')}</Tab>
            </TabList>

            <TabPanels>
              <TabPanel>
                {selectedTab === getConsultaExternaTabIndex('triage') ? (
                  <div className={styles.combinedPanel}>
                    <ExtensionSlot name="consulta-externa-vitals-summary-slot" state={{ patientUuid }} />
                  </div>
                ) : null}
              </TabPanel>
              <TabPanel>
                {selectedTab === getConsultaExternaTabIndex('antecedents') ? (
                  <ConsultaExternaAntecedents patientUuid={patientUuid} />
                ) : null}
              </TabPanel>
              <TabPanel>
                {selectedTab === getConsultaExternaTabIndex('anamnesis') ? (
                  <Anamnesis patientUuid={patientUuid} />
                ) : null}
              </TabPanel>
              <TabPanel>
                {selectedTab === getConsultaExternaTabIndex('soap') ? <ExamenFisico patientUuid={patientUuid} /> : null}
              </TabPanel>
              <TabPanel>
                {selectedTab === getConsultaExternaTabIndex('complementaryTests') ? (
                  <div className={styles.combinedPanel}>
                    <ExtensionSlot name="consulta-externa-pruebas-complementarias-slot" state={{ patientUuid }} />
                  </div>
                ) : null}
              </TabPanel>
              <TabPanel>
                {selectedTab === getConsultaExternaTabIndex('diagnosis') ? (
                  <DiagnosticoClasificado patientUuid={patientUuid} />
                ) : null}
              </TabPanel>
              <TabPanel>
                {selectedTab === getConsultaExternaTabIndex('treatment') ? (
                  <PlanTratamiento patientUuid={patientUuid} />
                ) : null}
              </TabPanel>
              <TabPanel>
                {selectedTab === getConsultaExternaTabIndex('referral') ? (
                  <ReferenciaContraReferencia patientUuid={patientUuid} />
                ) : null}
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Layer>
      </div>
    </RequirePrivilege>
  );
};

export default ConsultaExternaDashboard;
