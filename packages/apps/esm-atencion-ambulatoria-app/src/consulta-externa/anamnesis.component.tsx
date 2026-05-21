import { Accordion, AccordionItem, Button, InlineLoading, Tag } from '@carbon/react';
import { Add } from '@carbon/react/icons';
import { formatDate, useConfig } from '@openmrs/esm-framework';
import { launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../config-schema';
import { useAnamnesis } from '../hooks/useAnamnesis';
import { patientFormEntryWorkspace } from '../utils/constants';
import styles from './consulta-externa-dashboard.scss';

interface AnamnesisProps {
  patientUuid: string;
}

const Anamnesis: React.FC<AnamnesisProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();
  const { anamnesisEntries, isLoading } = useAnamnesis(
    patientUuid,
    config.encounterTypes?.externalConsultation,
    config.concepts,
  );

  const handleLaunchForm = () => {
    launchPatientWorkspace(patientFormEntryWorkspace, {
      formInfo: {
        patientUuid,
        formUuid: config.formsList?.anamnesisForm ?? config.formsList?.consultaExternaForm,
      },
    });
  };

  if (isLoading) {
    return <InlineLoading description={t('loading', 'Cargando...')} />;
  }

  return (
    <div className={styles.widgetContainer}>
      <div className={styles.tableHeader}>
        <span className={styles.tableHeaderTitle}>{t('anamnesisHistory', 'Historial de Anamnesis')}</span>
        <Button kind="ghost" size="sm" renderIcon={Add} onClick={handleLaunchForm}>
          {t('addAnamnesis', 'Registrar Anamnesis')}
        </Button>
      </div>

      {anamnesisEntries.length === 0 ? (
        <div className={styles.emptyState}>
          <p>{t('noAnamnesisData', 'No hay anamnesis registrada para este paciente.')}</p>
        </div>
      ) : (
        <Accordion>
          {anamnesisEntries.map((entry) => (
            <AccordionItem
              key={entry.encounterUuid}
              title={
                <span>
                  {formatDate(new Date(entry.encounterDatetime))}
                  {' — '}
                  <Tag type="outline" size="sm">
                    {entry.provider || t('unknownProvider', 'Proveedor desconocido')}
                  </Tag>
                </span>
              }
            >
              <div className={styles.soapSection}>
                <h5>{t('chiefComplaint', 'Motivo de Consulta')}</h5>
                <p>{entry.chiefComplaint || t('noData', 'Sin datos')}</p>
              </div>
              <div className={styles.soapSection}>
                <h5>{t('currentIllness', 'Enfermedad actual')}</h5>
                <p>
                  <strong>{t('illnessDuration', 'Tiempo de enfermedad')}:</strong>{' '}
                  {entry.illnessDuration || t('noData', 'Sin datos')}
                </p>
                <p>
                  <strong>{t('onsetType', 'Forma de inicio')}:</strong> {entry.onsetType || t('noData', 'Sin datos')}
                </p>
                <p>
                  <strong>{t('course', 'Curso')}:</strong> {entry.course || t('noData', 'Sin datos')}
                </p>
                <p>{entry.narrative || t('noData', 'Sin datos')}</p>
              </div>
              <div className={styles.soapSection}>
                <h5>{t('biologicalFunctions', 'Funciones biológicas')}</h5>
                <p>
                  <strong>{t('appetite', 'Apetito')}:</strong>{' '}
                  {entry.biologicalFunctions.appetite || t('noData', 'Sin datos')}
                </p>
                <p>
                  <strong>{t('thirst', 'Sed')}:</strong> {entry.biologicalFunctions.thirst || t('noData', 'Sin datos')}
                </p>
                <p>
                  <strong>{t('sleep', 'Sueño')}:</strong> {entry.biologicalFunctions.sleep || t('noData', 'Sin datos')}
                </p>
                <p>
                  <strong>{t('mood', 'Estado de ánimo')}:</strong>{' '}
                  {entry.biologicalFunctions.mood || t('noData', 'Sin datos')}
                </p>
                <p>
                  <strong>{t('urine', 'Orina')}:</strong> {entry.biologicalFunctions.urine || t('noData', 'Sin datos')}
                </p>
                <p>
                  <strong>{t('bowelMovements', 'Deposiciones')}:</strong>{' '}
                  {entry.biologicalFunctions.bowelMovements || t('noData', 'Sin datos')}
                </p>
              </div>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
};

export default Anamnesis;
