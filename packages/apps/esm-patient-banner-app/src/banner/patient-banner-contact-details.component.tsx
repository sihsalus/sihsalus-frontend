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
import classNames from 'classnames';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type ConfigObject } from '../config-schema';
import { useEthnicIdentity } from '../hooks/useEthnicIdentity';
import { usePatientAdditionalAttributes, usePatientContactAttributes } from '../hooks/usePatientAttributes';
import { usePatientListsForPatient } from '../hooks/usePatientListsForPatient';
import { useRelationships } from '../hooks/useRelationships';
import styles from './patient-banner-contact-details.module.scss';

const contactDetailsLoadingTimeoutMs = 10000;

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

const PatientLists: React.FC<{ patientUuid: string }> = ({ patientUuid }) => {
  const { cohorts = [], isLoading } = usePatientListsForPatient(patientUuid);
  const showLoading = useBoundedLoading(isLoading);

  return (
    <>
      <p className={styles.heading}>
        {getCoreTranslation('patientLists', 'Patient Lists')} ({cohorts?.length ?? 0})
      </p>
      {showLoading ? (
        <InlineLoading description={`${getCoreTranslation('loading', 'Loading')} ...`} role="progressbar" />
      ) : (
        <ul>
          {(() => {
            if (cohorts?.length > 0) {
              const sortedLists = cohorts.sort(
                (a, b) => parseDate(a?.startDate).getTime() - parseDate(b?.startDate).getTime(),
              );
              const slicedLists = sortedLists.slice(0, 3);
              return slicedLists?.map((cohort) => (
                <li key={cohort.uuid}>
                  <ConfigurableLink to={`${window.spaBase}/home/patient-lists/${cohort.uuid}`}>
                    {cohort.name}
                  </ConfigurableLink>
                </li>
              ));
            }
            return <li>--</li>;
          })()}
          {cohorts.length > 3 && (
            <li>
              <ConfigurableLink to={`${window.spaBase}/home/patient-lists`}>
                {getCoreTranslation('seeMoreLists', 'See {{count}} more lists', {
                  count: cohorts?.length - 3,
                })}
              </ConfigurableLink>
            </li>
          )}
        </ul>
      )}
    </>
  );
};

const Address: React.FC<{ patientId: string }> = ({ patientId }) => {
  const { patient, isLoading } = usePatient(patientId);
  const address = patient?.address?.find((entry) => entry.use === 'home');
  const getAddressKey = (url: string) => url.split('#')[1];
  const showLoading = useBoundedLoading(isLoading);

  if (showLoading) {
    return <InlineLoading description={`${getCoreTranslation('loading', 'Loading')} ...`} role="progressbar" />;
  }

  return (
    <>
      <p className={styles.heading}>{getCoreTranslation('address', 'Address')}</p>
      <ul>
        {address ? (
          Object.entries(address)
            .filter(([key]) => key !== 'id' && key !== 'use')
            .map(([key, value]) =>
              key === 'extension' ? (
                address.extension?.[0]?.extension?.map((addressExtension, index) => (
                  <li key={`address-${key}-${index}`}>
                    {getCoreTranslation(
                      getAddressKey(addressExtension.url) as CoreTranslationKey,
                      getAddressKey(addressExtension.url) as CoreTranslationKey,
                    )}
                    : {addressExtension.valueString}
                  </li>
                ))
              ) : (
                <li key={`address-${key}`}>
                  {getCoreTranslation(key as CoreTranslationKey, key)}: {value}
                </li>
              ),
            )
        ) : (
          <li>--</li>
        )}
      </ul>
    </>
  );
};

const Contact: React.FC<{ patientUuid: string }> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const { ethnicIdentityConceptUuid } = useConfig<ConfigObject>();
  const { isLoading: isLoadingAttributes, contactAttributes } = usePatientContactAttributes(patientUuid);
  const { currentValue: ethnicIdentity, isLoading: isLoadingEthnicIdentity } = useEthnicIdentity(
    patientUuid,
    ethnicIdentityConceptUuid,
  );
  const showLoading = useBoundedLoading(isLoadingAttributes || isLoadingEthnicIdentity);

  const contacts = useMemo(
    () =>
      contactAttributes
        ? contactAttributes.map((contact) => [
            contact.attributeType.display
              ? getCoreTranslation(contact.attributeType.display as CoreTranslationKey, contact.attributeType.display)
              : '',
            contact.value,
          ])
        : [],
    [contactAttributes],
  );

  return (
    <>
      <p className={styles.heading}>{getCoreTranslation('contactDetails', 'Contact Details')}</p>
      {showLoading ? (
        <InlineLoading description={`${getCoreTranslation('loading', 'Loading')} ...`} role="progressbar" />
      ) : (
        <ul>
          {contacts.map(([label, value], index) => (
            <li key={`${label}-${value}-${index}`}>
              {label}: {value}
            </li>
          ))}
          <li>
            {t('ethnicity', 'Ethnicity')}: {ethnicIdentity || '--'}
          </li>
        </ul>
      )}
    </>
  );
};

const getDisplayValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') {
    return '--';
  }

  if (typeof value === 'object') {
    const displayableValue = value as { display?: string; name?: string; value?: string | number };
    return String(displayableValue.display ?? displayableValue.name ?? displayableValue.value ?? '--');
  }

  return String(value);
};

const PatientAdministrativeDetails: React.FC<{ patientUuid: string }> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const { additionalAttributes, identifiers, isLoading, person } = usePatientAdditionalAttributes(patientUuid);
  const showLoading = useBoundedLoading(isLoading);
  const gender = person?.gender
    ? getCoreTranslation(person.gender === 'M' ? 'male' : person.gender === 'F' ? 'female' : 'unknown', person.gender)
    : '--';
  const status = person ? (person.dead ? t('deceased', 'Deceased') : t('active', 'Active')) : '--';

  return (
    <>
      <div className={styles.col}>
        <p className={styles.heading}>{t('demographics', 'Demographics')}</p>
        {showLoading ? (
          <InlineLoading description={`${getCoreTranslation('loading', 'Loading')} ...`} role="progressbar" />
        ) : (
          <ul>
            <li>
              {t('age', 'Age')}: {person?.age ?? '--'}
            </li>
            <li>
              {t('dateOfBirth', 'Date of birth')}:{' '}
              {person?.birthdate ? formatDate(parseDate(person.birthdate), { mode: 'wide', time: false }) : '--'}
            </li>
            <li>
              {t('gender', 'Gender')}: {gender}
            </li>
            <li>
              {t('status', 'Status')}: {status}
            </li>
            {person?.dead && (
              <li>
                {t('deathDate', 'Death date')}:{' '}
                {person?.deathDate
                  ? formatDate(parseDate(String(person.deathDate)), { mode: 'wide', time: false })
                  : '--'}
              </li>
            )}
          </ul>
        )}
      </div>
      <div className={styles.col}>
        <p className={styles.heading}>{t('identifiers', 'Identifiers')}</p>
        {showLoading ? (
          <InlineLoading description={`${getCoreTranslation('loading', 'Loading')} ...`} role="progressbar" />
        ) : (
          <ul>
            {identifiers?.length > 0 ? (
              identifiers.map((identifier) => (
                <li key={identifier.uuid}>
                  {identifier.identifierType?.name ?? t('identifier', 'Identifier')}: {identifier.identifier}
                  {identifier.preferred ? ` (${t('preferred', 'Preferred')})` : ''}
                </li>
              ))
            ) : (
              <li>--</li>
            )}
          </ul>
        )}
      </div>
      <div className={styles.col}>
        <p className={styles.heading}>{t('additionalDetails', 'Additional details')}</p>
        {showLoading ? (
          <InlineLoading description={`${getCoreTranslation('loading', 'Loading')} ...`} role="progressbar" />
        ) : (
          <ul>
            {additionalAttributes?.length > 0 ? (
              additionalAttributes.map((attribute) => (
                <li key={attribute.uuid}>
                  {attribute.attributeType.display
                    ? getCoreTranslation(
                        attribute.attributeType.display as CoreTranslationKey,
                        attribute.attributeType.display,
                      )
                    : t('attribute', 'Attribute')}
                  : {getDisplayValue(attribute.value)}
                </li>
              ))
            ) : (
              <li>--</li>
            )}
          </ul>
        )}
      </div>
    </>
  );
};

const Relationships: React.FC<{ patientId: string }> = ({ patientId }) => {
  const { data: relationships, isLoading } = useRelationships(patientId);
  const showLoading = useBoundedLoading(isLoading);

  return (
    <>
      <p className={styles.heading}>{getCoreTranslation('relationships', 'Relationships')}</p>
      {showLoading ? (
        <InlineLoading description={`${getCoreTranslation('loading', 'Loading')} ...`} role="progressbar" />
      ) : (
        <ul>
          {relationships && relationships.length > 0 ? (
            relationships.map((relationship) => (
              <li key={relationship.uuid} className={styles.relationship}>
                <div>
                  <ConfigurableLink to={`${window.spaBase}/patient/${relationship.relativeUuid}/chart`}>
                    {relationship.display}
                  </ConfigurableLink>
                </div>
                <div>{relationship.relationshipType}</div>
                <div>
                  {`${relationship.relativeAge ? relationship.relativeAge : '--'} ${
                    relationship.relativeAge
                      ? relationship.relativeAge === 1
                        ? getCoreTranslation('yearAbbreviation', 'yr')
                        : getCoreTranslation('yearsAbbreviation', 'yrs')
                      : ''
                  }`}
                </div>
              </li>
            ))
          ) : (
            <li>--</li>
          )}
        </ul>
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
        <div className={styles.col}>
          <PatientLists patientUuid={patientId} />
        </div>
        <PatientAdministrativeDetails patientUuid={patientId} />
      </div>
    </div>
  );
}
