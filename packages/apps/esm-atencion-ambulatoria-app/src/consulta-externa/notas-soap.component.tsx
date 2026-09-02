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

interface ExamenFisicoProps {
  patientUuid: string;
}

const ExamenFisico: React.FC<ExamenFisicoProps> = ({ patientUuid }) => {
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
  const physicalExamEntries = soapEntries.filter(
    (entry) => hasSegmentedPhysicalExam(entry.physicalExam) || Boolean(entry.objective),
  );

  return (
    <ClinicalHistoryCard
      title={t('physicalExamHistory', 'Historial de examen físico')}
      actionLabel={t('recordPhysicalExam', 'Registrar examen físico')}
      empty={physicalExamEntries.length === 0}
      emptyDisplayText={t('physicalExamRecords', 'registros de examen físico')}
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
        {physicalExamEntries.map((entry) => (
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
            {hasSegmentedPhysicalExam(entry.physicalExam) ? (
              <div className={`${styles.soapSection} ${styles.soapObjective}`}>
                <h5>{t('physicalExam', 'Examen físico')}</h5>
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
                <h5>{t('physicalExam', 'Examen físico')}</h5>
                <p>{entry.objective || t('noData', 'Sin datos')}</p>
              </div>
            )}
          </AccordionItem>
        ))}
      </Accordion>
    </ClinicalHistoryCard>
  );
};

export default ExamenFisico;
