import { SkeletonText } from '@carbon/react';
import { useConfig } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { type Observation } from '../visit.resource';

import styles from './styles.scss';

interface EncounterObservationsProps {
  observations?: Array<Observation> | null;
}

const EncounterObservations: React.FC<EncounterObservationsProps> = ({ observations }) => {
  const { t } = useTranslation();
  const { obsConceptUuidsToHide = [] } = useConfig();

  function getAnswerFromDisplay(display: string): string {
    const colonIndex = display.indexOf(':');
    if (colonIndex === -1) {
      return '';
    } else {
      return display.substring(colonIndex + 1).trim();
    }
  }

  if (!observations) {
    return <SkeletonText />;
  }

  const filteredObservations = obsConceptUuidsToHide.length
    ? observations.filter((obs) => {
        return !obsConceptUuidsToHide.includes(obs?.concept?.uuid);
      })
    : observations;

  if (filteredObservations.length > 0) {
    return (
      <div className={styles.observation}>
        {filteredObservations.map((obs) => {
          if (obs.groupMembers) {
            return (
              <React.Fragment key={obs.uuid}>
                <span className={styles.parentConcept}>{obs.concept.display}</span>
                <span />
                {obs.groupMembers.map((member) => (
                  <React.Fragment key={member.uuid}>
                    <span className={styles.childConcept}>{member.concept.display}</span>
                    <span>{getAnswerFromDisplay(member.display)}</span>
                  </React.Fragment>
                ))}
              </React.Fragment>
            );
          }

          return (
            <React.Fragment key={obs.uuid}>
              <span>{obs.concept.display}</span>
              <span>{getAnswerFromDisplay(obs.display)}</span>
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <div className={styles.observation}>
      <p>{t('noObservationsFound', 'No observations found')}</p>
    </div>
  );
};

export default EncounterObservations;
