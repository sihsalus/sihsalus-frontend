import { InlineLoading } from '@carbon/react';
import {
  ConfigurableLink,
  type CoreTranslationKey,
  formatDate,
  getCoreTranslation,
  parseDate,
  useConfig,
  usePatient,
} from '@openmrs/esm-framework';
import { age } from '@openmrs/esm-utils';
import classNames from 'classnames';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type ConfigObject } from '../config-schema';
import { useEthnicIdentity } from '../hooks/useEthnicIdentity';
import { usePatientAdditionalAttributes, usePatientContactAttributes } from '../hooks/usePatientAttributes';
import { usePatientListsForPatient } from '../hooks/usePatientListsForPatient';
import { useRelationships } from '../hooks/useRelationships';
import { type Attribute } from '../types';
import styles from './patient-banner-contact-details.module.scss';

const contactDetailsLoadingTimeoutMs = 10000;

const peruAddressFieldLabels: Record<string, { defaultValue: string; translationKey: string }> = {
  address1: { defaultValue: 'Department', translationKey: 'department' },
  address3: { defaultValue: 'Neighborhood', translationKey: 'neighborhood' },
  address4: { defaultValue: 'Address', translationKey: 'streetAddress' },
  city: { defaultValue: 'Population center', translationKey: 'populationCenter' },
  cityVillage: { defaultValue: 'Population center', translationKey: 'populationCenter' },
  country: { defaultValue: 'Country', translationKey: 'country' },
  countyDistrict: { defaultValue: 'District', translationKey: 'district' },
  district: { defaultValue: 'District', translationKey: 'district' },
  state: { defaultValue: 'Province', translationKey: 'province' },
  stateProvince: { defaultValue: 'Province', translationKey: 'province' },
};

interface ContactDetailsProps {
  patientId: string;
  deceased: boolean;
}

function useBoundedLoading(isLoading: boolean) {
  const [hasTimedOut, setHasTimedOut] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setHasTimedOut(false);
      return;
    }

    setHasTimedOut(false);
    const timeoutId = globalThis.setTimeout(() => setHasTimedOut(true), contactDetailsLoadingTimeoutMs);
    return () => globalThis.clearTimeout(timeoutId);
  }, [isLoading]);

  return isLoading && !hasTimedOut;
}

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '' || value === '--') {
    return null;
  }

  return (
    <li>
      <span className={styles.itemLabel}>{label}:</span> {value}
    </li>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className={styles.emptyState}>{message}</p>;
}

function formatAgeUnit(
  value: number,
  singularKey: string,
  singularFallback: string,
  pluralKey: string,
  pluralFallback: string,
  t: ReturnType<typeof useTranslation>['t'],
) {
  const unit = value === 1 ? t(singularKey, singularFallback) : t(pluralKey, pluralFallback);

  return `${value} ${unit}`;
}

function formatAgeWithUnit(
  birthdate: string | undefined,
  ageInYears: number | undefined,
  t: ReturnType<typeof useTranslation>['t'],
) {
  if (birthdate) {
    return age(birthdate) ?? '';
  }

  return ageInYears !== undefined ? formatAgeUnit(ageInYears, 'ageYear', 'year', 'ageYears', 'years', t) : '';
}

function getAttributeByTypeUuid(attributes: Array<Attribute>, uuid?: string) {
  return uuid ? attributes.find(({ attributeType }) => attributeType?.uuid === uuid) : undefined;
}

function getAddressFieldLabel(fieldName: string, t: ReturnType<typeof useTranslation>['t']) {
  const peruLabel = peruAddressFieldLabels[fieldName];

  return peruLabel
    ? t(peruLabel.translationKey, peruLabel.defaultValue)
    : getCoreTranslation(fieldName as CoreTranslationKey, fieldName);
}

const PatientLists: React.FC<{ patientUuid: string }> = ({ patientUuid }) => {
  const { cohorts = [], isLoading } = usePatientListsForPatient(patientUuid);
  const showLoading = useBoundedLoading(isLoading);
  const sortedLists = useMemo(
    () => [...cohorts].sort((a, b) => parseDate(a?.startDate).getTime() - parseDate(b?.startDate).getTime()),
    [cohorts],
  );

  if (!showLoading && sortedLists.length === 0) {
    return null;
  }

  return (
    <div className={styles.col}>
      <p className={styles.heading}>
        {getCoreTranslation('patientLists', 'Patient Lists')} ({sortedLists.length})
      </p>
      {showLoading ? (
        <InlineLoading description={`${getCoreTranslation('loading', 'Loading')} ...`} role="progressbar" />
      ) : (
        <ul className={styles.detailList}>
          {sortedLists.slice(0, 3).map((cohort) => (
            <li key={cohort.uuid}>
              <ConfigurableLink to={`${window.spaBase}/home/patient-lists/${cohort.uuid}`}>
                {cohort.name}
              </ConfigurableLink>
            </li>
          ))}
          {sortedLists.length > 3 && (
            <li>
              <ConfigurableLink to={`${window.spaBase}/home/patient-lists`}>
                {getCoreTranslation('seeMoreLists', 'See {{count}} more lists', {
                  count: sortedLists.length - 3,
                })}
              </ConfigurableLink>
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

const Address: React.FC<{ patientId: string }> = ({ patientId }) => {
  const { t } = useTranslation();
  const { patient, isLoading } = usePatient(patientId);
  const address = patient?.address?.find((entry) => entry.use === 'home');
  const getAddressKey = (url: string) => url.split('#')[1];
  const hiddenAddressExtensionFields = new Set(['address13', 'address14', 'address15']);
  const showLoading = useBoundedLoading(isLoading);

  if (showLoading) {
    return <InlineLoading description={`${getCoreTranslation('loading', 'Loading')} ...`} role="progressbar" />;
  }

  return (
    <>
      <p className={styles.heading}>{t('residence', 'Place of residence')}</p>
      {address ? (
        <ul className={styles.detailList}>
          {Object.entries(address)
            .filter(([key]) => key !== 'id' && key !== 'use')
            .map(([key, value]) =>
              key === 'extension' ? (
                address.extension?.[0]?.extension
                  ?.filter((addressExtension) => !hiddenAddressExtensionFields.has(getAddressKey(addressExtension.url)))
                  .map((addressExtension) => (
                    <DetailItem
                      key={`address-${key}-${addressExtension.url}`}
                      label={getAddressFieldLabel(getAddressKey(addressExtension.url), t)}
                      value={addressExtension.valueString}
                    />
                  ))
              ) : (
                <DetailItem key={`address-${key}`} label={getAddressFieldLabel(key, t)} value={value} />
              ),
            )}
        </ul>
      ) : (
        <EmptyState message={t('noResidence', 'No residence recorded')} />
      )}
    </>
  );
};

const Contact: React.FC<{ patientUuid: string }> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const { isLoading: isLoadingAttributes, contactAttributes } = usePatientContactAttributes(patientUuid);
  const showLoading = useBoundedLoading(isLoadingAttributes);

  const contacts = useMemo(
    () =>
      contactAttributes
        ? contactAttributes.map((contact) => ({
            key: contact.uuid,
            label: contact.attributeType.display
              ? getCoreTranslation(contact.attributeType.display as CoreTranslationKey, contact.attributeType.display)
              : '',
            value: getDisplayValue(contact.value),
          }))
        : [],
    [contactAttributes],
  );

  return (
    <>
      <p className={styles.heading}>{getCoreTranslation('contactDetails', 'Contact Details')}</p>
      {showLoading ? (
        <InlineLoading description={`${getCoreTranslation('loading', 'Loading')} ...`} role="progressbar" />
      ) : contacts.length > 0 ? (
        <ul className={styles.detailList}>
          {contacts.map(({ key, label, value }) => (
            <DetailItem key={key} label={label} value={value} />
          ))}
        </ul>
      ) : (
        <EmptyState message={t('noContactDetails', 'No contact details recorded')} />
      )}
    </>
  );
};

const getDisplayValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  if (typeof value === 'object') {
    const displayableValue = value as { display?: string; name?: string; value?: string | number };
    return String(displayableValue.display ?? displayableValue.name ?? displayableValue.value ?? '');
  }

  return String(value);
};

function RelationshipMetaItem({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '' || value === '--') {
    return null;
  }

  return (
    <span>
      <span className={styles.itemLabel}>{label}:</span> {value}
    </span>
  );
}

const PatientAdministrativeDetails: React.FC<{ patientUuid: string }> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const {
    birthplaceAttributeTypeUuid,
    ethnicIdentityAttributeTypeUuid,
    ethnicIdentityConceptUuid,
    occupationAttributeTypeUuid,
    nationalityAttributeTypeUuid,
  } = useConfig<ConfigObject>();
  const { additionalAttributes, identifiers, isLoading, person } = usePatientAdditionalAttributes(patientUuid);
  const { currentValue: ethnicIdentity, isLoading: isLoadingEthnicIdentity } = useEthnicIdentity(
    patientUuid,
    ethnicIdentityConceptUuid,
    ethnicIdentityAttributeTypeUuid,
  );
  const showLoading = useBoundedLoading(isLoading || isLoadingEthnicIdentity);
  const gender = person?.gender
    ? getCoreTranslation(person.gender === 'M' ? 'male' : person.gender === 'F' ? 'female' : 'unknown', person.gender)
    : '';
  const formattedAge = formatAgeWithUnit(person?.birthdate, person?.age, t);
  const birthplace = getDisplayValue(getAttributeByTypeUuid(additionalAttributes, birthplaceAttributeTypeUuid)?.value);
  const occupation = getDisplayValue(getAttributeByTypeUuid(additionalAttributes, occupationAttributeTypeUuid)?.value);
  const reservedAttributeTypeUuids = new Set([
    birthplaceAttributeTypeUuid,
    ethnicIdentityAttributeTypeUuid,
    occupationAttributeTypeUuid,
  ]);
  const remainingAdditionalAttributes = additionalAttributes.filter(
    ({ attributeType }) => !reservedAttributeTypeUuids.has(attributeType?.uuid),
  );
  const hasDemographics = Boolean(formattedAge || person?.birthdate || gender || person?.deathDate);
  const hasIdentifiers = identifiers?.length > 0;
  const hasAdditionalDetails = Boolean(
    ethnicIdentity ||
      occupation ||
      birthplace ||
      remainingAdditionalAttributes.some((attribute) => getDisplayValue(attribute.value)),
  );

  return (
    <>
      <div className={styles.col}>
        <p className={styles.heading}>{t('demographics', 'Demographics')}</p>
        {showLoading ? (
          <InlineLoading description={`${getCoreTranslation('loading', 'Loading')} ...`} role="progressbar" />
        ) : hasDemographics ? (
          <ul className={styles.detailList}>
            <DetailItem label={t('age', 'Age')} value={formattedAge} />
            <DetailItem
              label={t('dateOfBirth', 'Date of birth')}
              value={person?.birthdate ? formatDate(parseDate(person.birthdate), { mode: 'wide', time: false }) : ''}
            />
            <DetailItem label={t('gender', 'Gender')} value={gender} />
            {person?.dead && (
              <>
                <DetailItem label={t('status', 'Status')} value={t('deceased', 'Deceased')} />
                <DetailItem
                  label={t('deathDate', 'Death date')}
                  value={
                    person?.deathDate
                      ? formatDate(parseDate(String(person.deathDate)), { mode: 'wide', time: false })
                      : ''
                  }
                />
              </>
            )}
          </ul>
        ) : (
          <EmptyState message={t('noDemographics', 'No demographics recorded')} />
        )}
      </div>
      <div className={styles.col}>
        <p className={styles.heading}>{t('identifiers', 'Identifiers')}</p>
        {showLoading ? (
          <InlineLoading description={`${getCoreTranslation('loading', 'Loading')} ...`} role="progressbar" />
        ) : hasIdentifiers ? (
          <ul className={styles.detailList}>
            {identifiers.map((identifier) => (
              <DetailItem
                key={identifier.uuid}
                label={identifier.identifierType?.name ?? t('identifier', 'Identifier')}
                value={
                  <>
                    {identifier.identifier}
                    {identifier.preferred ? ` (${t('preferred', 'Preferred')})` : ''}
                  </>
                }
              />
            ))}
          </ul>
        ) : (
          <EmptyState message={t('noIdentifiers', 'No identifiers recorded')} />
        )}
      </div>
      <div className={styles.col}>
        <p className={styles.heading}>{t('additionalDetails', 'Additional details')}</p>
        {showLoading ? (
          <InlineLoading description={`${getCoreTranslation('loading', 'Loading')} ...`} role="progressbar" />
        ) : hasAdditionalDetails ? (
          <ul className={styles.detailList}>
            <DetailItem label={t('ethnicity', 'Ethnicity')} value={ethnicIdentity} />
            <DetailItem label={t('occupation', 'Occupation')} value={occupation} />
            <DetailItem label={t('birthplace', 'Place of birth')} value={birthplace} />
            {remainingAdditionalAttributes.map((attribute) => (
              <DetailItem
                key={attribute.uuid}
                label={
                  attribute.attributeType.uuid === nationalityAttributeTypeUuid
                    ? t('nationalityCountry', 'País de nacionalidad')
                    : attribute.attributeType.display
                      ? getCoreTranslation(
                          attribute.attributeType.display as CoreTranslationKey,
                          attribute.attributeType.display,
                        )
                      : t('attribute', 'Attribute')
                }
                value={getDisplayValue(attribute.value)}
              />
            ))}
          </ul>
        ) : (
          <EmptyState message={t('noAdditionalDetails', 'No additional details recorded')} />
        )}
      </div>
    </>
  );
};

const Relationships: React.FC<{ patientId: string }> = ({ patientId }) => {
  const { t } = useTranslation();
  const { data: relationships, isLoading } = useRelationships(patientId);
  const showLoading = useBoundedLoading(isLoading);

  return (
    <>
      <p className={styles.heading}>Familiares</p>
      {showLoading ? (
        <InlineLoading description={`${getCoreTranslation('loading', 'Loading')} ...`} role="progressbar" />
      ) : relationships && relationships.length > 0 ? (
        <ul className={styles.detailList}>
          {relationships.map((relationship) => (
            <li key={relationship.uuid} className={styles.relationship}>
              <span className={styles.relationshipContent}>
                <ConfigurableLink to={`${window.spaBase}/patient/${relationship.relativeUuid}/chart`}>
                  {relationship.display}
                </ConfigurableLink>
                <span className={styles.relationshipMeta}>
                  <RelationshipMetaItem
                    label={t('relationship', 'Relationship')}
                    value={relationship.relationshipType}
                  />
                  <RelationshipMetaItem
                    label={t('age', 'Age')}
                    value={
                      relationship.relativeAge
                        ? `${relationship.relativeAge} ${
                            relationship.relativeAge === 1 ? t('yearAbbreviation', 'yr') : t('yearsAbbreviation', 'yrs')
                          }`
                        : ''
                    }
                  />
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState message={t('noRelationships', 'No relationships recorded')} />
      )}
    </>
  );
};

export function PatientBannerContactDetails({ patientId, deceased }: ContactDetailsProps) {
  return (
    <div
      className={classNames(styles.contactDetails, {
        [styles.deceased]: deceased,
      })}
    >
      <div className={styles.tiles}>
        <div className={styles.col}>
          <Address patientId={patientId} />
        </div>
        <div className={styles.col}>
          <Contact patientUuid={patientId} />
        </div>
        <div className={styles.col}>
          <Relationships patientId={patientId} />
        </div>
        <PatientAdministrativeDetails patientUuid={patientId} />
        <PatientLists patientUuid={patientId} />
      </div>
    </div>
  );
}
