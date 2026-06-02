import { Tag, TagSkeleton, Tooltip } from '@carbon/react';
import { getCoreTranslation, translateFrom } from '@openmrs/esm-framework';
import classNames from 'classnames';
import React from 'react';
import { severityOrder } from '../utils';
import styles from './allergies-list.scss';
import { useAllergies } from './allergy-intolerance.resource';

const moduleName = '@sihsalus/esm-patient-allergies-app';

interface AllergyListProps {
  patientUuid: string;
}

const AllergyList: React.FC<AllergyListProps> = ({ patientUuid }) => {
  const { allergies, isLoading } = useAllergies(patientUuid);

  const sortedAllergies = allergies?.sort((a, b) => {
    const severityA = a.reactionSeverity ? severityOrder[a.reactionSeverity] : undefined;
    const severityB = b.reactionSeverity ? severityOrder[b.reactionSeverity] : undefined;

    return (severityA ?? Number.MAX_SAFE_INTEGER) - (severityB ?? Number.MAX_SAFE_INTEGER);
  });

  if (isLoading) {
    return (
      <div className={styles.container}>
        <TagSkeleton />
      </div>
    );
  }

  if (sortedAllergies?.length) {
    return (
      <div className={classNames(styles.label, styles.container)}>
        <span>{translateFrom(moduleName, 'allergies', 'Allergies')}:</span>
        {sortedAllergies.map((allergy) => (
          <Tooltip
            align="bottom"
            key={allergy.id}
            label={`${allergy.reactionToSubstance} - ${allergy.reactionSeverity ? translateFrom(moduleName, allergy.reactionSeverity) : getCoreTranslation('unknown')}`}
          >
            <Tag
              className={styles.allergyLabel}
              data-severity={allergy.reactionSeverity?.toLowerCase()}
              data-testid={`allergy-tag-${allergy.reactionSeverity?.toLowerCase()}`}
            >
              {allergy.reactionToSubstance}
            </Tag>
          </Tooltip>
        ))}
      </div>
    );
  }

  return (
    <div className={classNames(styles.label, styles.container)}>
      {translateFrom(moduleName, 'allergies', 'Allergies')}: {getCoreTranslation('unknown')}
    </div>
  );
};

export default AllergyList;
