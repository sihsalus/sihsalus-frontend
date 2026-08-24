import { Tag, Tile } from '@carbon/react';
import { age, PatientPhoto, UserAvatarIcon } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { PersonSearchResult } from '../relationships/relationship.resources';

import styles from './patient-search-info.scss';

type PatientSearchInfoProps = {
  person: PersonSearchResult;
};

const PatientSearchInfo: React.FC<PatientSearchInfoProps> = ({ person }) => {
  const { t } = useTranslation();
  const identifier = person.identifiers.find((candidate) => candidate.preferred) ?? person.identifiers[0];

  return (
    <Tile className={styles.patientInfo}>
      <div className={styles.personAvatar} role="img">
        {person.isPatient ? (
          <PatientPhoto patientUuid={person.uuid} patientName={person.display} />
        ) : (
          <UserAvatarIcon aria-label={t('personWithoutRecord', 'No clinical record')} size={32} />
        )}
      </div>
      <div className={styles.patientDetails}>
        <h2 className={styles.patientName}>{person.display}</h2>
        <div className={styles.demographics}>
          {person.gender ?? '-'} <span className={styles.middot}>&middot;</span>{' '}
          {person.birthdate ? age(person.birthdate) : '-'}
          <span className={styles.middot}>&middot;</span>
          {identifier && (
            <Tag>
              {identifier.identifierType.display}: {identifier.identifier}
            </Tag>
          )}
          {!person.isPatient && <Tag type="gray">{t('personWithoutRecord', 'No clinical record')}</Tag>}
        </div>
      </div>
    </Tile>
  );
};

export default PatientSearchInfo;
