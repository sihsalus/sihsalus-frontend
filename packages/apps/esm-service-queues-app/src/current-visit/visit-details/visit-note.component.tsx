import { Button, Tag } from '@carbon/react';
import { ArrowRight } from '@carbon/react/icons';
import {
  launchWorkspace2,
  showSnackbar,
  usePatient,
  userHasAccess,
  useSession,
  type Visit,
} from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { serviceQueuesVisitNotesWorkspace, visitNotesEditPrivilege } from '../../constants';
import { type DiagnosisItem, type Note } from '../../types/index';

import styles from './triage-note.scss';

interface VisitNoteProps {
  notes: Array<Note>;
  diagnoses: Array<DiagnosisItem>;
  patientUuid: string;
  visit?: Visit;
}

const VisitNote: React.FC<VisitNoteProps> = ({ notes, patientUuid, diagnoses, visit }) => {
  const { t } = useTranslation();
  const { patient } = usePatient(patientUuid);
  const session = useSession();
  const canEditVisitNotes = userHasAccess(visitNotesEditPrivilege, session?.user);
  const hasSummary = diagnoses.length > 0 || notes.length > 0;
  const hasVerifiedVisitContext = Boolean(visit?.uuid && visit.location?.uuid);

  const handleOpenVisitNote = async () => {
    try {
      const opened = await launchWorkspace2(serviceQueuesVisitNotesWorkspace, {}, null, {
        patient,
        patientUuid,
        visitContext: visit,
      });
      if (opened !== true) {
        throw new Error('workspace launch rejected');
      }
    } catch {
      showSnackbar({
        isLowContrast: false,
        kind: 'error',
        title: t('visitNoteOpenError', 'Could not open the visit summary'),
        subtitle: t('visitNoteOpenErrorSubtitle', 'Check your access and the active visit, then try again.'),
      });
    }
  };

  return (
    <div>
      {diagnoses.length > 0
        ? diagnoses.map((d: DiagnosisItem) => (
            <Tag key={d.diagnosis} type="blue" size="md">
              {d.diagnosis}
            </Tag>
          ))
        : null}
      {notes.length ? (
        notes.map((note: Note) => (
          <div key={`${note.time}-${note.note}`}>
            <p>{note.note}</p>
            <p className={styles.subHeading}>
              {note.provider.name ? <span> {note.provider.name} · </span> : null}
              {note.time}
            </p>
          </div>
        ))
      ) : hasSummary ? null : (
        <p className={styles.emptyText}>
          {t('visitFormNotCompleted', 'Visit form has not been completed for this visit')}
        </p>
      )}
      {canEditVisitNotes && hasVerifiedVisitContext ? (
        <Button
          size="sm"
          kind="ghost"
          disabled={!patient}
          renderIcon={(props) => <ArrowRight size={16} {...props} />}
          onClick={() => void handleOpenVisitNote()}
          iconDescription={
            hasSummary ? t('editVisitNoteForm', 'Edit visit summary') : t('visitNoteForm', 'Visit note form')
          }
        >
          {hasSummary ? t('editVisitNoteForm', 'Edit visit summary') : t('visitNoteForm', 'Visit note form')}
        </Button>
      ) : null}
    </div>
  );
};

export default VisitNote;
