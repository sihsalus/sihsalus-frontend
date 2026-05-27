import { InlineLoading } from '@carbon/react';
import {
  ConfigurableLink,
  getCoreTranslation,
  parseDate,
  usePatient,
  type CoreTranslationKey,
} from '@openmrs/esm-framework';
import classNames from 'classnames';
import React, { useMemo } from 'react';
import { usePatientContactAttributes } from '../hooks/usePatientAttributes';
import { usePatientListsForPatient } from '../hooks/usePatientListsForPatient';
import { useRelationships } from '../hooks/useRelationships';
import styles from './patient-banner-contact-details.module.scss';

interface ContactDetailsProps {
  patientId: string;
  deceased: boolean;
}

const PatientLists: React.FC<{ patientUuid: string }> = ({ patientUuid }) => {
  const { cohorts = [], isLoading } = usePatientListsForPatient(patientUuid);

  return (
    <>
      <p className={styles.heading}>
        {getCoreTranslation('patientLists', 'Patient Lists')} ({cohorts?.length ?? 0})
      </p>
      {isLoading ? (
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

  if (isLoading) {
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
  const { isLoading: isLoadingAttributes, contactAttributes } = usePatientContactAttributes(patientUuid);

  const contacts = useMemo(
    () =>
      contactAttributes
        ? contactAttributes.map((contact) => [
            contact.attributeType.display
              ? getCoreTranslation(
                  contact.attributeType.display as CoreTranslationKey,
                  contact.attributeType.display,
                )
              : '',
            contact.value,
          ])
        : [],
    [contactAttributes],
  );

  return (
    <>
      <p className={styles.heading}>{getCoreTranslation('contactDetails', 'Contact Details')}</p>
      {isLoadingAttributes ? (
        <InlineLoading description={`${getCoreTranslation('loading', 'Loading')} ...`} role="progressbar" />
      ) : (
        <ul>
          {contacts.length ? (
            contacts.map(([label, value], index) => (
              <li key={`${label}-${value}-${index}`}>
                {label}: {value}
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

const Relationships: React.FC<{ patientId: string }> = ({ patientId }) => {
  const { data: relationships, isLoading } = useRelationships(patientId);

  return (
    <>
      <p className={styles.heading}>{getCoreTranslation('relationships', 'Relationships')}</p>
      {isLoading ? (
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
      <div className={styles.row}>
        <div className={styles.col}>
          <Address patientId={patientId} />
        </div>
        <div className={styles.col}>
          <Contact patientUuid={patientId} />
        </div>
      </div>
      <div className={styles.row}>
        <div className={styles.col}>
          <Relationships patientId={patientId} />
        </div>
        <div className={styles.col}>
          <PatientLists patientUuid={patientId} />
        </div>
      </div>
    </div>
  );
}
