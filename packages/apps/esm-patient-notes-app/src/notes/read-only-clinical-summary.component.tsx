import { Accordion, AccordionItem, InlineLoading, InlineNotification, Tag } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import type { VisitNoteClinicalContext } from './visit-notes.resource';
import styles from './read-only-clinical-summary.scss';

export default function ReadOnlyClinicalSummary({
  clinicalContext,
  error,
  isLoading,
  isValidating,
}: {
  clinicalContext: VisitNoteClinicalContext;
  error?: Error;
  isLoading: boolean;
  isValidating: boolean;
}) {
  const { t } = useTranslation();
  const sections = [
    {
      id: 'clinical-summary',
      title: t('clinicalSummary', 'Clinical summary'),
      fields: [
        {
          id: 'chief-complaint',
          label: t('chiefComplaint', 'Chief complaint'),
          value: clinicalContext.chiefComplaint,
        },
        {
          id: 'illness-duration',
          label: t('illnessDuration', 'Illness duration'),
          value: clinicalContext.illnessDuration,
        },
        {
          id: 'biological-functions',
          label: t('biologicalFunctions', 'Biological functions'),
          value: clinicalContext.biologicalFunctions,
        },
      ],
    },
    {
      id: 'orders-and-continuity',
      title: t('workPlan', 'Orders and continuity of care'),
      fields: [
        {
          id: 'auxiliary-exams',
          label: t('auxiliaryExams', 'Auxiliary exams'),
          value: clinicalContext.auxiliaryExams,
        },
        {
          id: 'procedures',
          label: t('procedures', 'Procedures'),
          value: clinicalContext.procedures,
        },
        {
          id: 'prescriptions',
          label: t('prescriptions', 'Prescriptions'),
          value: clinicalContext.prescriptions,
        },
        {
          id: 'referral',
          label: t('referral', 'Referral / counter-referral'),
          value: clinicalContext.referral,
        },
      ],
    },
  ]
    .map((section) => ({ ...section, fields: section.fields.filter((field) => field.value?.trim()) }))
    .filter((section) => section.fields.length > 0);

  return (
    <section aria-label={t('clinicalSummary', 'Clinical summary')} className={styles.summary}>
      {isLoading || isValidating ? (
        <InlineLoading
          description={t('clinicalSummaryLoading', 'Loading the outpatient clinical summary...')}
          status="active"
        />
      ) : null}
      {error ? (
        <InlineNotification
          hideCloseButton
          kind="error"
          lowContrast
          title={t('clinicalSummaryLoadErrorTitle', 'The clinical summary could not be loaded')}
          subtitle={t('clinicalSummaryLoadErrorDescription', 'Reload before relying on this outpatient summary.')}
        />
      ) : null}
      <Accordion size="sm">
        <AccordionItem
          title={
            <span className={styles.heading}>
              <span>{t('clinicalSummary', 'Clinical summary')}</span>
              <Tag size="sm" type="gray">
                {t('readOnly', 'Read-only')}
              </Tag>
            </span>
          }
        >
          {!isLoading && sections.length > 0 ? (
            <>
              <p className={styles.description}>
                {t(
                  'clinicalSummaryReadOnlyDescription',
                  'Records from outpatient care. Only fields with information are shown.',
                )}
              </p>
              {sections.map((section) => (
                <div className={styles.section} key={section.id}>
                  {section.id !== 'clinical-summary' ? <h4>{section.title}</h4> : null}
                  <dl className={styles.fields}>
                    {section.fields.map((field) => (
                      <div className={styles.field} key={field.id}>
                        <dt>{field.label}</dt>
                        <dd>{field.value.trim()}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </>
          ) : null}
          {!isLoading && !isValidating && !error && sections.length === 0 ? (
            <p className={styles.empty}>
              {t('clinicalSummaryEmpty', 'No additional information to display in this summary.')}
            </p>
          ) : null}
        </AccordionItem>
      </Accordion>
    </section>
  );
}
