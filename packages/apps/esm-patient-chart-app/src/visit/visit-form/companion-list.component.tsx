import React from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import { InlineLoading } from '@carbon/react';
import { type FetchResponse, openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import styles from './visit-form.scss';

interface CompanionListProps {
  patientUuid: string;
}

interface RelationshipResults {
  results: Array<{
    uuid: string;
    personA: { uuid: string; display: string };
    personB: { uuid: string; display: string };
  }>;
}

/**
 * Lists the patient's companions (Acompañante relationships) on the start
 * visit form. The relationship type to look up is configurable; when it is not
 * set the section renders nothing.
 */
const CompanionList: React.FC<CompanionListProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const { companionRelationshipTypeUuid } = useConfig<{ companionRelationshipTypeUuid?: string }>();

  const url =
    patientUuid && companionRelationshipTypeUuid
      ? `${restBaseUrl}/relationship?person=${patientUuid}&relation=${companionRelationshipTypeUuid}&v=custom:(uuid,personA:(uuid,display),personB:(uuid,display))`
      : null;
  const { data, isLoading } = useSWR<FetchResponse<RelationshipResults>>(url, openmrsFetch);

  if (!companionRelationshipTypeUuid) {
    return null;
  }

  const companions = (data?.data?.results ?? []).map((relationship) => ({
    uuid: relationship.uuid,
    name: relationship.personA.uuid === patientUuid ? relationship.personB.display : relationship.personA.display,
  }));

  return (
    <section>
      <h1 className={styles.sectionTitle}>{t('companions', 'Companions')}</h1>
      <div className={styles.sectionField}>
        {isLoading ? (
          <InlineLoading description={t('loading', 'Loading...')} />
        ) : companions.length ? (
          <ul>
            {companions.map((companion) => (
              <li key={companion.uuid}>{companion.name}</li>
            ))}
          </ul>
        ) : (
          <p>{t('noCompanionsRegistered', 'No companions registered')}</p>
        )}
      </div>
    </section>
  );
};

export default CompanionList;
