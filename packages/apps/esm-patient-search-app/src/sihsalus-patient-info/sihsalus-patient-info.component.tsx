import { age, ExtensionSlot, formatPartialDate, getPatientName } from '@openmrs/esm-framework';
import React, { useMemo } from 'react';
import styles from './sihsalus-patient-info.scss';

interface SihsalusPatientInfoProps {
  patient: fhir.Patient;
  renderedFrom?: string;
}

const dniIdentifierTypeUuid = '550e8400-e29b-41d4-a716-446655440001';

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
    coding?.code === dniIdentifierTypeUuid
  );
}

function isClinicalHistoryIdentifier(identifier: fhir.Identifier) {
  const type = identifier.type;
  const typeText = type?.text?.trim().toLowerCase() ?? '';
  const coding = type?.coding?.[0];
  const codingCode = coding?.code?.trim().toLowerCase() ?? '';
  const codingDisplay = coding?.display?.trim().toLowerCase() ?? '';

  return (
    typeText.includes('historia') ||
    typeText.includes('clinical') ||
    codingDisplay.includes('historia') ||
    codingDisplay.includes('clinical') ||
    codingCode.includes('historia') ||
    codingCode.includes('clinical')
  );
}

function getIdentifierOrder(identifier: fhir.Identifier) {
  if (isDniIdentifier(identifier)) {
    return 0;
  }

  if (isClinicalHistoryIdentifier(identifier)) {
    return 2;
  }

  return 1;
}

function getGenderDisplay(gender?: string) {
  switch (gender?.toLowerCase()) {
    case 'male':
      return { icon: '\u2642', label: 'Masculino' };
    case 'female':
      return { icon: '\u2640', label: 'Femenino' };
    case 'other':
      return { icon: '', label: 'Otro' };
    case 'unknown':
      return { icon: '', label: 'Desconocido' };
    default:
      return gender ? { icon: '', label: gender } : null;
  }
}

function Identifier({ identifier, highlighted }: { identifier: fhir.Identifier; highlighted: boolean }) {
  const label = identifier.type?.text;

  return (
    <span className={highlighted ? styles.highlightedIdentifier : styles.plainIdentifier}>
      {label ? <span>{label}:&nbsp;</span> : null}
      {highlighted ? (
        <strong className={styles.identifierValue}>{identifier.value}</strong>
      ) : (
        <span className={styles.identifierValue}>{identifier.value}</span>
      )}
    </span>
  );
}

function PatientIdentifiers({ identifiers }: { identifiers?: fhir.Identifier[] }) {
  const filteredIdentifiers = [...(identifiers?.filter((identifier) => identifier.value) ?? [])].sort(
    (firstIdentifier, secondIdentifier) => getIdentifierOrder(firstIdentifier) - getIdentifierOrder(secondIdentifier),
  );
  const hasDniIdentifier = filteredIdentifiers.some(isDniIdentifier);

  return (
    <>
      {filteredIdentifiers.map((identifier, index) => {
        const highlighted = hasDniIdentifier ? isDniIdentifier(identifier) : index === 0;

        return (
          <React.Fragment key={`${identifier.type?.text}-${identifier.value}`}>
            <Identifier identifier={identifier} highlighted={highlighted} />
            {index < filteredIdentifiers.length - 1 ? (
              <span className={styles.patientInfoSeparator}>&middot;</span>
            ) : null}
          </React.Fragment>
        );
      })}
    </>
  );
}

export function SihsalusPatientInfo({ patient, renderedFrom }: SihsalusPatientInfoProps) {
  const gender = getGenderDisplay(patient.gender);
  const extensionState = useMemo(() => ({ patientUuid: patient.id, patient, renderedFrom }), [patient, renderedFrom]);

  return (
    <div className={styles.patientInfo}>
      <div className={styles.patientNameRow}>
        <span className={styles.patientName}>{getPatientName(patient)}</span>
        {gender ? (
          <span className={styles.patientGender}>
            {gender.icon ? <span aria-hidden="true">{gender.icon}</span> : null}
            <span>{gender.label}</span>
          </span>
        ) : null}
        <ExtensionSlot className={styles.patientTagsSlot} name="patient-banner-tags-slot" state={extensionState} />
      </div>
      <div className={styles.patientDemographics}>
        {patient.birthDate ? (
          <>
            <span>{age(patient.birthDate)}</span>
            <span className={styles.patientInfoSeparator}>&middot;</span>
            <span>{formatPartialDate(patient.birthDate, { time: false })}</span>
            <span className={styles.patientInfoSeparator}>&middot;</span>
          </>
        ) : null}
        <PatientIdentifiers identifiers={patient.identifier} />
        <ExtensionSlot className={styles.patientBottomSlot} name="patient-banner-bottom-slot" state={extensionState} />
      </div>
    </div>
  );
}
