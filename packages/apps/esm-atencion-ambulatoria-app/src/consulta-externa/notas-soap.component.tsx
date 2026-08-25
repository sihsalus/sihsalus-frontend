import { Accordion, AccordionItem, Tag } from '@carbon/react';
import { formatDate, useConfig } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../config-schema';
import { useConsultaExternaFormLauncher } from '../hooks/useConsultaExternaFormLauncher';
import { useSoapNotes } from '../hooks/useSoapNotes';
import { clinicalFormsPrivilege, consultaExternaEditPrivilege } from '../utils/constants';
import { hasSegmentedPhysicalExam, physicalExamFields } from '../utils/physical-exam';
import ClinicalHistoryCard from './clinical-history-card.component';
import styles from './consulta-externa-dashboard.scss';

interface NotasSoapProps {
  patientUuid: string;
}

const NotasSoap: React.FC<NotasSoapProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();
  const { soapEntries, isLoading, isValidating, error, mutate, pagination, sourceErrors } = useSoapNotes(
    patientUuid,
    [
      config.encounterTypes?.externalConsultation,
      {
        encounterTypeUuid: config.encounterTypes?.visitNote,
        formUuid: config.formsList?.visitNoteFormUuid,
        visitTypeUuid: config.visitTypes?.ambulatory,
      },
    ],
    config.concepts,
  );

  const handleLaunchForm = useConsultaExternaFormLauncher({
    patientUuid,
    formIdentifier: config.formsList?.soapNoteForm ?? config.formsList?.consultaExternaForm,
    encounterTypeUuid: config.encounterTypes?.externalConsultation,
    ambulatoryVisitTypeUuid: config.visitTypes?.ambulatory,
    mutate,
    entryMode: 'one-per-visit',
  });

  return (
    <ClinicalHistoryCard
      title={t('soapNotesHistory', 'Historial de examen físico / SOAP')}
      actionLabel={t('addSoapNote', 'Registrar examen físico segmentado')}
      empty={soapEntries.length === 0}
      emptyDisplayText={t('physicalExamAndSoapNotes', 'registros de examen físico / SOAP')}
      editPrivilege={[consultaExternaEditPrivilege, clinicalFormsPrivilege]}
      error={error}
      isLoading={isLoading}
      isValidating={isValidating}
      loadingVariant="accordion"
      onAction={handleLaunchForm}
      pagination={pagination}
      sourceErrors={sourceErrors}
    >
      <Accordion>
        {soapEntries.map((entry) => (
          <AccordionItem
            key={entry.encounterUuid}
            title={
              <span>
                {formatDate(new Date(entry.encounterDatetime), { time: true })}
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
            {hasSegmentedPhysicalExam(entry.physicalExam) ? (
              <div className={`${styles.soapSection} ${styles.soapObjective}`}>
                <h5>{t('segmentedPhysicalExam', 'Examen físico segmentado')}</h5>
                <dl className={styles.physicalExamGrid}>
                  {physicalExamFields.map((field) =>
                    entry.physicalExam[field.key] ? (
                      <div key={field.key}>
                        <dt>{t(field.translationKey, field.defaultLabel)}</dt>
                        <dd>{entry.physicalExam[field.key]}</dd>
                      </div>
                    ) : null,
                  )}
                </dl>
              </div>
            ) : (
              <div className={`${styles.soapSection} ${styles.soapObjective}`}>
                <h5>{t('objective', 'Objetivo (O)')}</h5>
                <p>{entry.objective || t('noData', 'Sin datos')}</p>
              </div>
            )}
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
