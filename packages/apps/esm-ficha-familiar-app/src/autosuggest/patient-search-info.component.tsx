import { Tag, Tile } from '@carbon/react';
import type { Patient } from '@openmrs/esm-framework';
import { age, getPreferredIdentifier, PatientPhoto } from '@openmrs/esm-framework';
import React from 'react';

import styles from './patient-search-info.scss';

type PatientSearchInfoProps = {
  patient: Patient;
};

const PatientSearchInfo: React.FC<PatientSearchInfoProps> = ({ patient }) => {
  const identifier = getPreferredIdentifier(patient.identifiers ?? []);

  return (
    <Tile className={styles.patientInfo}>
      <div className={styles.patientAvatar} role="img">
        <PatientPhoto patientUuid={patient.uuid} patientName={patient.person.display} />
      </div>
      <div className={styles.patientDetails}>
        <h2 className={styles.patientName}>{patient.person.display}</h2>
        <div className={styles.demographics}>
          {patient?.person?.gender} <span className={styles.middot}>&middot;</span>{' '}
          {patient.person?.birthdate ? age(patient.person.birthdate) : '-'}
          <span className={styles.middot}>&middot;</span>
          {identifier && (
            <Tag>
              {identifier.identifierType.display}: {identifier.identifier}
            </Tag>
          )}
        </div>
      </div>
    </Tile>
  );
};

export default PatientSearchInfo;
