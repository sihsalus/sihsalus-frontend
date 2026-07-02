import { Layer, Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import { ExtensionSlot } from '@openmrs/esm-framework';
import { Activity, ArrowRight, Catalog, DocumentMultiple_01, ListChecked } from '@carbon/react/icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import Anamnesis from './anamnesis.component';
import styles from './consulta-externa-dashboard.scss';
import DiagnosticoClasificado from './diagnostico-clasificado.component';
import NotasSoap from './notas-soap.component';
import PlanTratamiento from './plan-tratamiento.component';
import ReferenciaContraReferencia from './referencia-contrarreferencia.component';

interface ConsultaExternaDashboardProps {
  patientUuid: string;
}

const ConsultaExternaDashboard: React.FC<ConsultaExternaDashboardProps> = ({ patientUuid }) => {
  const { t } = useTranslation();

  return (
    <div>
      <Layer className={styles.tabsContainer}>
        <Tabs>
          <TabList contained activation="manual" aria-label={t('consultaExternaTabs', 'Consulta Externa tabs')}>
            <Tab renderIcon={Activity}>{t('triageAndChiefComplaint', 'Triajes previos')}</Tab>
            <Tab renderIcon={DocumentMultiple_01}>{t('anamnesis', 'Anamnesis')}</Tab>
            <Tab renderIcon={Catalog}>{t('diagnosisClassification', 'Diagnóstico')}</Tab>
            <Tab renderIcon={DocumentMultiple_01}>{t('soapNotes', 'Notas SOAP')}</Tab>
            <Tab renderIcon={ListChecked}>{t('treatmentPlan', 'Plan de Tratamiento')}</Tab>
            <Tab renderIcon={ArrowRight}>{t('referralCounterReferral', 'Referencia / Contrarreferencia')}</Tab>
          </TabList>

          <TabPanels>
            <TabPanel>
              <div className={styles.combinedPanel}>
                <ExtensionSlot name="consulta-externa-vitals-summary-slot" state={{ patientUuid }} />
              </div>
            </TabPanel>
            <TabPanel>
              <Anamnesis patientUuid={patientUuid} />
            </TabPanel>
            <TabPanel>
              <DiagnosticoClasificado patientUuid={patientUuid} />
            </TabPanel>
            <TabPanel>
              <NotasSoap patientUuid={patientUuid} />
            </TabPanel>
            <TabPanel>
              <PlanTratamiento patientUuid={patientUuid} />
            </TabPanel>
            <TabPanel>
              <ReferenciaContraReferencia patientUuid={patientUuid} />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Layer>
    </div>
  );
};

export default ConsultaExternaDashboard;
