import {
  StructuredListBody,
  StructuredListCell,
  StructuredListHead,
  StructuredListRow,
  StructuredListWrapper,
} from '@carbon/react';
import {
  formatTime,
  type OpenmrsResource,
  parseDate,
  userHasAccess,
  useConfig,
  useSession,
  type Visit,
} from '@openmrs/esm-framework';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { type ConfigObject } from '../../config-schema';
import { visitNotesPrivilege, vitalsPrivilege } from '../../constants';
import { type DiagnosisItem, type Encounter, type Note, type Observation } from '../../types/index';
import styles from '../current-visit.scss';
import { useVitalsFromObs } from '../hooks/useVitalsConceptMetadata';

import VisitNote from './visit-note.component';
import Vitals from './vitals.component';

interface CurrentVisitProps {
  patientUuid: string;
  encounters: Array<Encounter | OpenmrsResource>;
  visit?: Visit;
}

enum visitTypes {
  CURRENT = 'currentVisit',
  PAST = 'pastVisit',
}

const CurrentVisitDetails: React.FC<CurrentVisitProps> = ({ patientUuid, encounters, visit }) => {
  const { t } = useTranslation();
  const { concepts, visitNoteEncounterTypeUuid } = useConfig<ConfigObject>();
  const session = useSession();
  const canViewVisitSummary = userHasAccess(visitNotesPrivilege, session?.user);
  const canViewVitals = userHasAccess(vitalsPrivilege, session?.user);

  const [diagnoses, notes, vitalsToRetrieve]: [Array<DiagnosisItem>, Array<Note>, Array<Encounter>] = useMemo(() => {
    const notes: Array<Note> = [];
    const vitalsToRetrieve: Array<Encounter> = [];
    const diagnoses: Array<DiagnosisItem> = [];

    // Iterating through every Encounter
    encounters?.forEach((enc: Encounter) => {
      // Check for Visit Diagnoses and Notes
      if (enc.encounterType?.uuid === visitNoteEncounterTypeUuid) {
        enc.obs?.forEach((obs: Observation) => {
          if (obs.concept?.uuid === concepts.visitDiagnosesConceptUuid) {
            const problemList = obs.groupMembers?.find((mem) => mem.concept?.uuid === concepts.problemListConceptUuid);
            if (problemList?.value?.display) {
              diagnoses.push({ diagnosis: problemList.value.display });
            }
          } else if (obs.concept?.uuid === concepts.generalPatientNoteConceptUuid) {
            // Putting all notes in a single array.
            notes.push({
              note: obs.value,
              provider: {
                name: enc.encounterProviders.length ? enc.encounterProviders[0].provider.person.display : '',
                role: enc.encounterProviders.length ? enc.encounterProviders[0].encounterRole.display : '',
              },
              time: formatTime(parseDate(obs.obsDatetime)),
              concept: obs.concept,
            });
          }
        });
      }

      vitalsToRetrieve.push(enc);
    });
    return [diagnoses, notes, vitalsToRetrieve];
  }, [
    encounters,
    visitNoteEncounterTypeUuid,
    concepts.generalPatientNoteConceptUuid,
    concepts.problemListConceptUuid,
    concepts.visitDiagnosesConceptUuid,
  ]);
  const vitals = useVitalsFromObs(vitalsToRetrieve);

  return (
    <div className={styles.wrapper}>
      <div className={styles.visitContainer}>
        <StructuredListWrapper className={styles.structuredList}>
          <StructuredListHead></StructuredListHead>
          <StructuredListBody>
            {canViewVisitSummary ? (
              <StructuredListRow className={styles.structuredListRow}>
                <StructuredListCell>{t('visitNote', 'Visit note')}</StructuredListCell>
                <StructuredListCell>
                  <VisitNote notes={notes} diagnoses={diagnoses} patientUuid={patientUuid} />
                </StructuredListCell>
              </StructuredListRow>
            ) : null}

            {canViewVitals ? (
              <StructuredListRow className={styles.structuredListRow}>
                <StructuredListCell>{t('vitals', 'Vitals')}</StructuredListCell>
                <StructuredListCell>
                  {' '}
                  <Vitals vitals={vitals} patientUuid={patientUuid} visitType={visitTypes.CURRENT} visit={visit} />
                </StructuredListCell>
              </StructuredListRow>
            ) : null}
          </StructuredListBody>
        </StructuredListWrapper>
      </div>
    </div>
  );
};

export default CurrentVisitDetails;
