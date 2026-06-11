import { SkeletonText } from '@carbon/react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { mapConceptToFormLabel, mapObsValueToFormLabel } from './encounter-list-utils';
import styles from './encounter-observation-component.scss';
import type { Observation } from './types';

interface EncounterObservationsProps {
  observations: Array<Observation>;
  formConceptMap: Record<string, Record<string, unknown>>;
  obsConceptUuidsToHide?: string[];
}

type NamedValue = {
  uuid?: string;
};

const EncounterObservations: React.FC<EncounterObservationsProps> = ({
  observations,
  formConceptMap,
  obsConceptUuidsToHide = [],
}) => {
  const { t } = useTranslation();

  if (!observations) {
    return <SkeletonText data-testid="skeleton-text" />;
  }

  if (observations?.length > 0) {
    const filteredObservations = obsConceptUuidsToHide.length
      ? observations?.filter((obs) => {
          return !obsConceptUuidsToHide.includes(obs?.concept?.uuid);
        })
      : observations;
    return (
      <div className={styles.observation}>
        {filteredObservations?.map((obs, parentIndex) => {
          if (obs.groupMembers) {
            return (
              <React.Fragment key={parentIndex}>
                <span className={styles.parentConcept}>{obs.concept.display ?? 'Group'}</span>
                <span />
                {obs.groupMembers.map((member, childIndex) => (
                  <React.Fragment key={childIndex}>
                    <span className={styles.childConcept}>
                      {mapConceptToFormLabel(member?.concept?.uuid, formConceptMap, member.concept.display)}
                    </span>
                    <span>
                      {mapObsValueToFormLabel(
                        member?.concept?.uuid,
                        typeof member.value === 'object' && member.value !== null
                          ? (member.value as NamedValue).uuid
                          : undefined,
                        formConceptMap,
                        member.display,
                      )}
                    </span>
                  </React.Fragment>
                ))}
              </React.Fragment>
            );
          } else {
            return (
              <React.Fragment key={parentIndex}>
                <span className={styles.questionText}>
                  {mapConceptToFormLabel(
                    obs?.concept?.uuid,
                    formConceptMap,
                    obs?.concept?.display ?? obs?.concept?.name?.name ?? '',
                  )}
                </span>
                <span>
                  {mapObsValueToFormLabel(
                    obs?.concept?.uuid,
                    typeof obs?.value === 'object' && obs?.value !== null ? (obs.value as NamedValue).uuid : undefined,
                    formConceptMap,
                    obs?.display ?? String(obs?.value ?? ''),
                  )}
                </span>
              </React.Fragment>
            );
          }
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
