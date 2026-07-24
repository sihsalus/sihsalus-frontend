/** @module @category UI */

import { InlineLoading } from '@carbon/react';
import { ConfigurableLink, usePatient } from '@openmrs/esm-react-utils';
import { type CoreTranslationKey, getCoreTranslation } from '@openmrs/esm-translations';
import { parseDate } from '@openmrs/esm-utils';
import classNames from 'classnames';
import React, { useMemo } from 'react';
import styles from './patient-banner-contact-details.module.scss';
import { usePatientContactAttributes } from './usePatientAttributes';
import { usePatientListsForPatient } from './usePatientListsForPatient';
import { useRelationships } from './useRelationships';

interface ContactDetailsProps {
  patientId: string;
  deceased: boolean;
}

const birthAddressMarkerField = 'address15';
const birthAddressMarker = 'SIHSALUS_BIRTH_ADDRESS';
const hiddenAddressExtensionFields = new Set(['address13', 'address14', birthAddressMarkerField]);
const standardAddressFields = ['city', 'district', 'state', 'postalCode', 'country'] as const;

function getAddressExtensionField(url?: string) {
  return url?.split('#')[1];
}

function getAddressExtensions(address?: fhir.Address) {
  return address?.extension?.flatMap((extensionContainer) => extensionContainer.extension ?? []) ?? [];
}

function getAddressExtensionValue(address: fhir.Address | undefined, field: string) {
  return getAddressExtensions(address).find(
    (addressExtension) => getAddressExtensionField(addressExtension.url) === field,
  )?.valueString;
}

function isBirthAddress(address: fhir.Address) {
  return getAddressExtensionValue(address, birthAddressMarkerField) === birthAddressMarker;
}

function getAddressDetails(address?: fhir.Address) {
  if (!address) {
    return [];
  }

  const extensionDetails = getAddressExtensions(address)
    .map((addressExtension, index) => ({
      field: getAddressExtensionField(addressExtension.url),
      key: `extension-${addressExtension.url}-${index}`,
      value: addressExtension.valueString?.trim(),
    }))
    .filter(
      (
        detail,
      ): detail is {
        field: string;
        key: string;
        value: string;
      } => !!detail.field && !!detail.value && !hiddenAddressExtensionFields.has(detail.field),
    );

  const lineDetails =
    address.line
      ?.map((line, index) => ({
        field: `address${index + 1}`,
        key: `line-${index}`,
        value: line.trim(),
      }))
      .filter(({ value }) => !!value) ?? [];

  const standardDetails = standardAddressFields
    .map((field) => ({
      field,
      key: `standard-${field}`,
      value: address[field]?.trim(),
    }))
    .filter(
      (
        detail,
      ): detail is {
        field: (typeof standardAddressFields)[number];
        key: string;
        value: string;
      } => !!detail.value,
    );

  const details = [...extensionDetails, ...lineDetails, ...standardDetails];
  if (!details.length && address.text?.trim()) {
    return [{ field: 'address', key: 'text', value: address.text.trim() }];
  }

  return details.filter(
    (detail, index) =>
      details.findIndex(
        (candidate) =>
          candidate.field === detail.field && candidate.value.toLocaleLowerCase() === detail.value.toLocaleLowerCase(),
      ) === index,
  );
}

const AddressDetails: React.FC<{ address?: fhir.Address }> = ({ address }) => {
  const details = getAddressDetails(address);

  return (
    <ul>
      {details.length ? (
        details.map(({ field, key, value }) => (
          <li key={key}>
            {getCoreTranslation(field as CoreTranslationKey, field)}: {value}
          </li>
        ))
      ) : (
        <li>--</li>
      )}
    </ul>
  );
};

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
                  <ConfigurableLink to={`${window.spaBase}/home/patient-lists/${cohort.uuid}`} key={cohort.uuid}>
                    {cohort.name}
                  </ConfigurableLink>
                </li>
              ));
            }
            return <li>--</li>;
          })()}
          {cohorts.length > 3 && (
            <li className={styles.link}>
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
  const birthAddress = patient?.address?.find(isBirthAddress);
  const residenceAddress =
    patient?.address?.find((address) => address.use === 'home' && !isBirthAddress(address)) ??
    patient?.address?.find((address) => !isBirthAddress(address));

  if (isLoading) {
    return <InlineLoading description={`${getCoreTranslation('loading', 'Loading')} ...`} role="progressbar" />;
  }

  return (
    <>
      <p className={styles.heading}>{getCoreTranslation('residence', 'Place of residence')}</p>
      <AddressDetails address={residenceAddress} />
      {birthAddress && (
        <>
          <p className={classNames(styles.heading, styles.secondaryAddressHeading)}>
            {getCoreTranslation('birthplace', 'Place of birth')}
          </p>
          <AddressDetails address={birthAddress} />
        </>
      )}
    </>
  );
};

const Contact: React.FC<{ patientUuid: string; deceased?: boolean }> = ({ patientUuid }) => {
  const { isLoading: isLoadingAttributes, contactAttributes } = usePatientContactAttributes(patientUuid);

  const contacts = useMemo(
    () =>
      contactAttributes
        ? [
            ...contactAttributes.map((contact) => [
              contact.attributeType.display
                ? getCoreTranslation(
                    /** TODO: We should probably add translation strings for some of these */
                    contact.attributeType.display as CoreTranslationKey,
                    contact.attributeType.display,
                  )
                : '',
              contact.value,
            ]),
          ]
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
      <p className={styles.heading}>Familiares</p>
      {isLoading ? (
        <InlineLoading description={`${getCoreTranslation('loading', 'Loading')} ...`} role="progressbar" />
      ) : (
        <ul>
          {relationships && relationships.length > 0 ? (
            <>
              {relationships.map((r) => (
                <li key={r.uuid} className={styles.relationship}>
                  <div>
                    <ConfigurableLink to={`${window.spaBase}/patient/${r.relativeUuid}/chart`}>
                      {r.display}
                    </ConfigurableLink>
                  </div>
                  <div>{r.relationshipType}</div>
                  <div>
                    {`${r.relativeAge ? r.relativeAge : '--'} ${
                      r.relativeAge
                        ? r.relativeAge === 1
                          ? getCoreTranslation('year', 'year')
                          : getCoreTranslation('years', 'years')
                        : ''
                    }`}
                  </div>
                </li>
              ))}
            </>
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
