import { Layer, Tab, TabList, TabPanel, TabPanels, Tabs, Tile } from '@carbon/react';
import { ExtensionSlot } from '@openmrs/esm-framework';
import { Activity, Catalog, DocumentMultiple_01, ListChecked } from '@carbon/react/icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import Anamnesis from './anamnesis.component';
import styles from './consulta-externa-dashboard.scss';
import DiagnosticoClasificado from './diagnostico-clasificado.component';
import MotivoConsulta from './motivo-consulta.component';
import NotasSoap from './notas-soap.component';
import PlanTratamiento from './plan-tratamiento.component';

interface ConsultaExternaDashboardProps {
  patientUuid: string;
}

const ConsultaExternaDashboard: React.FC<ConsultaExternaDashboardProps> = ({ patientUuid }) => {
  const { t } = useTranslation();

  return (
    <div>
      <Layer>
        <Tile>
          <div className={styles.desktopHeading}>
            <h4>{t('consultaExterna', 'Consulta Externa')}</h4>
          </div>
        </Tile>
      </Layer>

      <Layer className={styles.tabsContainer}>
        <Tabs>
          <TabList contained activation="manual" aria-label={t('consultaExternaTabs', 'Consulta Externa tabs')}>
            <Tab renderIcon={Activity}>{t('triageAndChiefComplaint', 'Triaje y Motivo de Consulta')}</Tab>
            <Tab renderIcon={DocumentMultiple_01}>{t('anamnesis', 'Anamnesis')}</Tab>
            <Tab renderIcon={Catalog}>{t('diagnosisClassification', 'Diagnóstico')}</Tab>
            <Tab renderIcon={DocumentMultiple_01}>{t('soapNotes', 'Notas SOAP')}</Tab>
            <Tab renderIcon={ListChecked}>{t('treatmentPlan', 'Plan de Tratamiento')}</Tab>
          </TabList>

          <TabPanels>
            <TabPanel>
              <div className={styles.combinedPanel}>
                <ExtensionSlot name="consulta-externa-vitals-summary-slot" state={{ patientUuid }} />
                <MotivoConsulta patientUuid={patientUuid} />
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
          </TabPanels>
        </Tabs>
      </Layer>
    </div>
  );
};

export default ConsultaExternaDashboard;
