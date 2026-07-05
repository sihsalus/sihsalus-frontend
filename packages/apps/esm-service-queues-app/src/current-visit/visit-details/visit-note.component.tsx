import { Button, Tag } from '@carbon/react';
import { ArrowRight } from '@carbon/react/icons';
import { launchWorkspace2, usePatient, useSession, userHasAccess } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { serviceQueuesEditPrivilege, serviceQueuesVisitNotesWorkspace } from '../../constants';
import { type DiagnosisItem, type Note } from '../../types/index';

import styles from './triage-note.scss';

interface VisitNoteProps {
  notes: Array<Note>;
  diagnoses: Array<DiagnosisItem>;
  patientUuid: string;
}

const VisitNote: React.FC<VisitNoteProps> = ({ notes, patientUuid, diagnoses }) => {
  const { t } = useTranslation();
  const { patient } = usePatient(patientUuid);
  const session = useSession();
  const canEdit = userHasAccess(serviceQueuesEditPrivilege, session?.user);

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
      ) : (
        <div>
          <p className={styles.emptyText}>
            {t('visitFormNotCompleted', 'Visit form has not been completed for this visit')}
          </p>
          {canEdit ? (
            <Button
              size="sm"
              kind="ghost"
              disabled={!patient}
              renderIcon={(props) => <ArrowRight size={16} {...props} />}
              onClick={() =>
                launchWorkspace2(serviceQueuesVisitNotesWorkspace, { formContext: 'creating' }, null, {
                  patient,
                  patientUuid,
                })
              }
              iconDescription={t('visitNoteForm', 'Visit note form')}
            >
              {t('visitNoteForm', 'Visit note form')}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default VisitNote;
