import { Accordion, AccordionItem, Tag } from '@carbon/react';
import { formatDate, useConfig } from '@openmrs/esm-framework';
import { launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../config-schema';
import { useSoapNotes } from '../hooks/useSoapNotes';
import { patientFormEntryWorkspace } from '../utils/constants';
import ClinicalHistoryCard from './clinical-history-card.component';
import styles from './consulta-externa-dashboard.scss';

interface NotasSoapProps {
  patientUuid: string;
}

const NotasSoap: React.FC<NotasSoapProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();
  const { soapEntries, isLoading, error } = useSoapNotes(
    patientUuid,
    config.encounterTypes?.externalConsultation,
    config.concepts,
  );

  const handleLaunchForm = () => {
    launchPatientWorkspace(patientFormEntryWorkspace, {
      formInfo: {
        patientUuid,
        formUuid: config.formsList?.soapNoteForm ?? config.formsList?.consultaExternaForm,
      },
    });
  };

  return (
    <ClinicalHistoryCard
      title={t('soapNotesHistory', 'Historial de examen físico / SOAP')}
      actionLabel={t('addSoapNote', 'Registrar examen físico / SOAP')}
      empty={soapEntries.length === 0}
      emptyMessage={t('noSoapData', 'No hay registros de examen físico / SOAP para este paciente.')}
      error={error}
      isLoading={isLoading}
      onAction={handleLaunchForm}
    >
      <Accordion>
        {soapEntries.map((entry) => (
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
            <div className={`${styles.soapSection} ${styles.soapSubjective}`}>
              <h5>{t('subjective', 'Subjetivo (S)')}</h5>
              <p>{entry.subjective || t('noData', 'Sin datos')}</p>
            </div>
            <div className={`${styles.soapSection} ${styles.soapObjective}`}>
              <h5>{t('objective', 'Objetivo (O)')}</h5>
              <p>{entry.objective || t('noData', 'Sin datos')}</p>
            </div>
            <div className={`${styles.soapSection} ${styles.soapAssessment}`}>
              <h5>{t('assessment', 'Apreciación (A)')}</h5>
              <p>{entry.assessment || t('noData', 'Sin datos')}</p>
            </div>
            <div className={`${styles.soapSection} ${styles.soapPlan}`}>
              <h5>{t('plan', 'Plan (P)')}</h5>
              <p>{entry.plan || t('noData', 'Sin datos')}</p>
            </div>
          </AccordionItem>
        ))}
      </Accordion>
    </ClinicalHistoryCard>
  );
};

export default NotasSoap;
