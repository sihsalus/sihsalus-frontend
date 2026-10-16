import { InlineLoading, Search } from '@carbon/react';
import { formatPartialDate, navigate, userHasAccess, useSession } from '@openmrs/esm-framework';
import {
  type Condition,
  getAntecedentTypeLabel,
  selectClinicalSearchTarget,
  usePatientConditions,
} from '@openmrs/esm-patient-common-lib';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './clinical-search.scss';

const conditionsPrivilege = 'app:hoja.clinica.condiciones';

export function matchesClinicalQuery(value: string, query: string): boolean {
  const normalize = (text: string) =>
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase()
      .trim();
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const candidate = normalize(value);
  return terms.length > 0 && terms.every((term) => candidate.includes(term));
}

function ConditionResults({ patientUuid, query }: { patientUuid: string; query: string }) {
  const { t } = useTranslation();
  const { conditions, error, isLoading } = usePatientConditions(patientUuid);

  if (isLoading) {
    return <InlineLoading description={t('clinicalSearchLoading', 'Loading clinical data')} />;
  }

  if (error || !conditions) {
    return <p role="alert">{t('clinicalSearchError', 'Clinical data could not be loaded. Try again later.')}</p>;
  }

  const matches = conditions.filter((condition: Condition) => {
    const type = condition.antecedentType
      ? getAntecedentTypeLabel(condition.antecedentType, t)
      : condition.categoryText;
    const status = condition.clinicalStatus
      ? t(condition.clinicalStatus.toLowerCase(), condition.clinicalStatus)
      : undefined;
    return matchesClinicalQuery(
      [condition.display, condition.nonCodedText, type, status, condition.onsetDateTime].filter(Boolean).join(' '),
      query,
    );
  });

  return matches.length ? (
    <div aria-live="polite">
      <p>
        {t('clinicalSearchResultCount', 'Matching problems or history entries: {{total}}', { total: matches.length })}
      </p>
      <ul className={styles.results}>
        {matches.map((condition: Condition) => (
          <li key={condition.id}>
            <button
              type="button"
              className={styles.resultLink}
              onClick={() => {
                selectClinicalSearchTarget({
                  kind: 'condition',
                  patientUuid,
                  resourceId: condition.id,
                });
                navigate({
                  to: `${globalThis.spaBase}/patient/${encodeURIComponent(patientUuid)}/chart/Antecedentes`,
                });
              }}
            >
              {condition.display || condition.nonCodedText}
            </button>
            {condition.antecedentType || condition.categoryText ? (
              <span>
                {condition.antecedentType
                  ? getAntecedentTypeLabel(condition.antecedentType, t)
                  : condition.categoryText}
              </span>
            ) : null}
            {condition.clinicalStatus ? (
              <span>{t(condition.clinicalStatus.toLowerCase(), condition.clinicalStatus)}</span>
            ) : null}
            {condition.onsetDateTime ? (
              <span>
                {t('clinicalSearchOnsetDate', 'Onset: {{date}}', {
                  date: formatPartialDate(condition.onsetDateTime, {
                    mode: 'wide',
                    time: 'for today',
                  }),
                })}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  ) : (
    <p aria-live="polite">{t('clinicalSearchNoResults', 'No matching problems or history entries')}</p>
  );
}

export default function ClinicalSearch({ patientUuid, patientId }: { patientUuid: string; patientId?: string }) {
  const { t } = useTranslation();
  const { user } = useSession();
  const [query, setQuery] = useState('');

  // The chart guard allows entry to the chart, while clinical sections retain their own permissions.
  if (!patientUuid || patientId !== patientUuid || !user || !userHasAccess(conditionsPrivilege, user)) {
    return null;
  }

  const searchTerm = query.trim();

  return (
    <section className={styles.search} aria-label={t('clinicalSearchTitle', 'Search clinical data')}>
      <Search
        id="patient-chart-clinical-search"
        labelText={t('clinicalSearchTitle', 'Search clinical data')}
        placeholder={t('clinicalSearchPlaceholder', 'Search problems and history')}
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
      />
      {searchTerm ? (
        <ConditionResults key={patientUuid} patientUuid={patientUuid} query={searchTerm} />
      ) : (
        <p className={styles.hint}>
          {t('clinicalSearchScope', 'Searches this patient’s problems and clinical history.')}
        </p>
      )}
    </section>
  );
}
