import { Accordion, AccordionItem, Button, InlineLoading, Tag } from '@carbon/react';
import { Add } from '@carbon/react/icons';
import { formatDate, useConfig } from '@openmrs/esm-framework';
import { launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../config-schema';
import { useSoapNotes } from '../hooks/useSoapNotes';
import { patientFormEntryWorkspace } from '../utils/constants';
import styles from './consulta-externa-dashboard.scss';

interface NotasSoapProps {
  patientUuid: string;
}

const NotasSoap: React.FC<NotasSoapProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();
  const { soapEntries, isLoading } = useSoapNotes(
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

  if (isLoading) {
    return <InlineLoading description={t('loading', 'Cargando...')} />;
  }

  return (
    <div className={styles.widgetContainer}>
      <div className={styles.tableHeader}>
        <span className={styles.tableHeaderTitle}>{t('soapNotesHistory', 'Historial de Notas SOAP')}</span>
        <Button kind="ghost" size="sm" renderIcon={Add} onClick={handleLaunchForm}>
          {t('addSoapNote', 'Registrar Nota SOAP')}
        </Button>
      </div>

      {soapEntries.length === 0 ? (
        <div className={styles.emptyState}>
          <p>{t('noSoapData', 'No hay notas SOAP registradas para este paciente.')}</p>
        </div>
      ) : (
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
      )}
    </div>
  );
};

export default NotasSoap;
