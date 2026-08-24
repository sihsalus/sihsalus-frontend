import { Layer, Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import { Activity, ArrowRight, Catalog, DocumentMultiple_01, ListChecked } from '@carbon/react/icons';
import { ExtensionSlot } from '@openmrs/esm-framework';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { consultaExternaPrivilege } from '../utils/constants';
import Anamnesis from './anamnesis.component';
import styles from './consulta-externa-dashboard.scss';
import DiagnosticoClasificado from './diagnostico-clasificado.component';
import NotasSoap from './notas-soap.component';
import PlanTratamiento from './plan-tratamiento.component';
import ReferenciaContraReferencia from './referencia-contrarreferencia.component';
import SisFinancingWarning from './sis-financing-warning.component';

interface ConsultaExternaDashboardProps {
  patientUuid: string;
}

const ConsultaExternaDashboard: React.FC<ConsultaExternaDashboardProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const [selectedTab, setSelectedTab] = useState(0);

  return (
    <RequirePrivilege privilege={consultaExternaPrivilege}>
      <div>
        <SisFinancingWarning patientUuid={patientUuid} />
        <Layer className={styles.tabsContainer}>
          <Tabs selectedIndex={selectedTab} onChange={({ selectedIndex }) => setSelectedTab(selectedIndex)}>
            <TabList contained activation="manual" aria-label={t('consultaExternaTabs', 'Consulta Externa tabs')}>
              <Tab renderIcon={Activity}>{t('triageAndChiefComplaint', 'Triajes previos')}</Tab>
              <Tab renderIcon={DocumentMultiple_01}>{t('anamnesis', 'Anamnesis')}</Tab>
              <Tab renderIcon={DocumentMultiple_01}>{t('soapNotes', 'Examen físico / SOAP')}</Tab>
              <Tab renderIcon={Catalog}>{t('diagnosisClassification', 'Diagnóstico')}</Tab>
              <Tab renderIcon={ListChecked}>{t('treatmentPlan', 'Plan de Tratamiento')}</Tab>
              <Tab renderIcon={ArrowRight}>{t('referralCounterReferral', 'Referencia / Contrarreferencia')}</Tab>
            </TabList>

            <TabPanels>
              <TabPanel>
                {selectedTab === 0 ? (
                  <div className={styles.combinedPanel}>
                    <ExtensionSlot name="consulta-externa-vitals-summary-slot" state={{ patientUuid }} />
                  </div>
                ) : null}
              </TabPanel>
              <TabPanel>{selectedTab === 1 ? <Anamnesis patientUuid={patientUuid} /> : null}</TabPanel>
              <TabPanel>{selectedTab === 2 ? <NotasSoap patientUuid={patientUuid} /> : null}</TabPanel>
              <TabPanel>{selectedTab === 3 ? <DiagnosticoClasificado patientUuid={patientUuid} /> : null}</TabPanel>
              <TabPanel>{selectedTab === 4 ? <PlanTratamiento patientUuid={patientUuid} /> : null}</TabPanel>
              <TabPanel>{selectedTab === 5 ? <ReferenciaContraReferencia patientUuid={patientUuid} /> : null}</TabPanel>
            </TabPanels>
          </Tabs>
        </Layer>
      </div>
    </RequirePrivilege>
  );
};

export default ConsultaExternaDashboard;
