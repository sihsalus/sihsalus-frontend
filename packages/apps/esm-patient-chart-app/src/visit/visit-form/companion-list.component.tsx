import React from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import { Button, ButtonSet, InlineLoading, RadioButton, RadioButtonGroup } from '@carbon/react';
import { type FetchResponse, openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import { type CompanionRecord } from './companion.resource';
import styles from './visit-form.scss';

interface CompanionListProps {
  companions: Array<CompanionRecord>;
  isLoading: boolean;
  onRegisterPerson?: () => void;
  onSearchPerson?: () => void;
  onSelectCompanion: (relationshipUuid: string) => void;
  required?: boolean;
  selectedCompanionRelationshipUuid?: string;
}

const defaultCompanionRelationshipTypeUuid = '3501ac02-0fb0-4ced-8a3e-f578f0ff5276';

interface RelationshipResult {
  uuid: string;
  personA: { uuid: string; display: string };
  personB: { uuid: string; display: string };
  relationshipType: { uuid: string };
}

interface RelationshipResults {
  results: Array<RelationshipResult>;
}

export function getPatientCompanions(
  relationships: Array<RelationshipResult>,
  patientUuid: string,
  companionRelationshipTypeUuid: string,
) {
  return relationships
    .filter(
      (relationship) =>
        relationship.relationshipType?.uuid === companionRelationshipTypeUuid &&
        (relationship.personA.uuid === patientUuid || relationship.personB.uuid === patientUuid),
    )
    .map((relationship) => ({
      relationshipUuid: relationship.uuid,
      personUuid: relationship.personA.uuid === patientUuid ? relationship.personB.uuid : relationship.personA.uuid,
      name: relationship.personA.uuid === patientUuid ? relationship.personB.display : relationship.personA.display,
    }));
}

/**
 * Lists the patient's companions (Acompañante relationships) on the start
 * visit form. The relationship type is configurable and falls back to the
 * SIH SALUS Acompañante relationship type.
 */
export function usePatientCompanions(patientUuid: string) {
  const { companionRelationshipTypeUuid: configuredCompanionRelationshipTypeUuid } = useConfig<{
    companionRelationshipTypeUuid?: string;
  }>();
  const companionRelationshipTypeUuid =
    configuredCompanionRelationshipTypeUuid || defaultCompanionRelationshipTypeUuid;

  const url =
    patientUuid && companionRelationshipTypeUuid
      ? `${restBaseUrl}/relationship?person=${patientUuid}&relation=${companionRelationshipTypeUuid}&v=custom:(uuid,personA:(uuid,display),personB:(uuid,display),relationshipType:(uuid))`
      : null;
  const { data, error, isLoading, mutate } = useSWR<FetchResponse<RelationshipResults>>(url, openmrsFetch);

  const companions = getPatientCompanions(
    data?.data?.results ?? [],
    patientUuid,
    companionRelationshipTypeUuid,
  );

  return { companions, companionRelationshipTypeUuid, error, isLoading, mutate };
}

const CompanionList: React.FC<CompanionListProps> = ({
  companions,
  isLoading,
  onRegisterPerson,
  onSearchPerson,
  onSelectCompanion,
  required = false,
  selectedCompanionRelationshipUuid,
}) => {
  const { t } = useTranslation();

  return (
    <section>
      <h1 className={styles.sectionTitle}>
        {t('companions', 'Acompañantes')}
        {required ? ' *' : ''}
      </h1>
      <div className={styles.sectionField}>
        {isLoading ? (
          <InlineLoading description={t('loading', 'Loading...')} />
        ) : companions.length ? (
          <RadioButtonGroup
            legendText={t('selectCompanionForVisit', 'Seleccione el acompañante para esta consulta')}
            name="visit-companion"
            onChange={(relationshipUuid: string) => onSelectCompanion(relationshipUuid)}
            orientation="vertical"
            valueSelected={selectedCompanionRelationshipUuid}
          >
            {companions.map((companion) => (
              <RadioButton
                id={`visit-companion-${companion.relationshipUuid}`}
                key={companion.relationshipUuid}
                labelText={companion.name}
                value={companion.relationshipUuid}
              />
            ))}
          </RadioButtonGroup>
        ) : (
          <p>
            {required
              ? t('companionRequiredForMinor', 'Un menor de edad debe tener al menos un acompañante registrado.')
              : t('noCompanionsRegistered', 'No hay acompañantes registrados')}
          </p>
        )}
        {required && (onSearchPerson || onRegisterPerson) ? (
          <ButtonSet className={styles.companionActions} stacked>
            {onSearchPerson ? (
              <Button kind="tertiary" onClick={onSearchPerson} size="sm" type="button">
                {t('selectExistingPerson', 'Seleccionar persona existente')}
              </Button>
            ) : null}
            {onRegisterPerson ? (
              <Button kind="ghost" onClick={onRegisterPerson} size="sm" type="button">
                {t('registerNewPerson', 'Registrar nueva persona')}
              </Button>
            ) : null}
          </ButtonSet>
        ) : null}
      </div>
    </section>
  );
};

export default CompanionList;
