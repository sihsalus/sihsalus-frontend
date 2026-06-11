/** @module @category UI */

import { FormLabel, Tag } from '@carbon/react';
import { useConfig, usePrimaryIdentifierCode } from '@openmrs/esm-react-utils';
import React from 'react';
import { type StyleguideConfigObject } from '../../config-schema';
import styles from './patient-banner-patient-info.module.scss';

interface IdentifiersProps {
  showIdentifierLabel: boolean;
  type: fhir.CodeableConcept | undefined;
  value: string | undefined;
}

interface PatientBannerPatientIdentifiersProps {
  identifiers: fhir.Identifier[] | undefined;
  showIdentifierLabel: boolean;
}

const dniIdentifierTypeUuid = '550e8400-e29b-41d4-a716-446655440001';
const dniValuePattern = /^\d{8}$/;

function PrimaryIdentifier({ showIdentifierLabel, type, value }: IdentifiersProps) {
  return (
    <span className={styles.primaryIdentifier}>
      <Tag className={styles.tag} type="gray">
        {showIdentifierLabel && type?.text && <span className={styles.label}>{type.text}: </span>}
        <span className={styles.value}>{value}</span>
      </Tag>
    </span>
  );
}

function SecondaryIdentifier({ showIdentifierLabel, type, value }: IdentifiersProps) {
  return (
    <FormLabel className={styles.secondaryIdentifier} id={`patient-banner-identifier-${value}`}>
      {showIdentifierLabel && <span className={styles.label}>{type?.text}: </span>}
      <span className={styles.value}>{value}</span>
    </FormLabel>
  );
}

function isDniIdentifier(identifier: fhir.Identifier) {
  const type = identifier.type;
  const typeText = type?.text?.trim().toLowerCase();
  const coding = type?.coding?.[0];
  const codingCode = coding?.code?.trim().toLowerCase();
  const codingDisplay = coding?.display?.trim().toLowerCase();

  return (
    typeText === 'dni' ||
    codingDisplay === 'dni' ||
    codingCode === 'dni' ||
    coding?.code === dniIdentifierTypeUuid ||
    Boolean(identifier.value && dniValuePattern.test(identifier.value))
  );
}

export function PatientBannerPatientIdentifiers({
  identifiers,
  showIdentifierLabel,
}: PatientBannerPatientIdentifiersProps) {
  const { excludePatientIdentifierCodeTypes } = useConfig<StyleguideConfigObject>();
  const { primaryIdentifierCode } = usePrimaryIdentifierCode();

  const filteredIdentifiers =
    identifiers?.filter((identifier) => {
      const code = identifier.type?.coding?.[0]?.code;
      return code && !excludePatientIdentifierCodeTypes?.uuids.includes(code);
    }) ?? [];
  const hasDniIdentifier = filteredIdentifiers.some(isDniIdentifier);

  return (
    <>
      {filteredIdentifiers?.length
        ? filteredIdentifiers.map((identifier, index) => {
            const { value, type } = identifier;
            const isDni = isDniIdentifier(identifier);
            const isPrimaryIdentifier = type?.coding?.[0]?.code === primaryIdentifierCode;
            const shouldHighlightIdentifier = isDni || (isPrimaryIdentifier && !hasDniIdentifier);

            return (
              <React.Fragment key={value}>
                <span className={styles.identifier}>
                  {shouldHighlightIdentifier ? (
                    <PrimaryIdentifier showIdentifierLabel={showIdentifierLabel} type={type} value={value} />
                  ) : (
                    <SecondaryIdentifier showIdentifierLabel={showIdentifierLabel} type={type} value={value} />
                  )}
                </span>
                {index < filteredIdentifiers.length - 1 && <span className={styles.separator}>&middot;</span>}
              </React.Fragment>
            );
          })
        : ''}
    </>
  );
}

export default PatientBannerPatientIdentifiers;
