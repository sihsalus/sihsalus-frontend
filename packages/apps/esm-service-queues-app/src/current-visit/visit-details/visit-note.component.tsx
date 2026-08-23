import { Button, Tag } from "@carbon/react";
import { ArrowRight } from "@carbon/react/icons";
import {
  launchWorkspace2,
  userHasAccess,
  usePatient,
  useSession,
  type Visit,
} from "@openmrs/esm-framework";
import React from "react";
import { useTranslation } from "react-i18next";

import {
  serviceQueuesVisitNotesWorkspace,
  visitNotesEditPrivilege,
} from "../../constants";
import { type DiagnosisItem, type Note } from "../../types/index";

import styles from "./triage-note.scss";

interface VisitNoteProps {
  notes: Array<Note>;
  diagnoses: Array<DiagnosisItem>;
  patientUuid: string;
  visitContext?: Visit;
}

const VisitNote: React.FC<VisitNoteProps> = ({
  notes,
  patientUuid,
  diagnoses,
  visitContext,
}) => {
  const { t } = useTranslation();
  const { patient } = usePatient(patientUuid);
  const session = useSession();
  const canEditVisitNotes = userHasAccess(
    visitNotesEditPrivilege,
    session?.user,
  );
  const hasSummary = diagnoses.length > 0 || notes.length > 0;

  const openVisitSummary = () =>
    launchWorkspace2(serviceQueuesVisitNotesWorkspace, {}, null, {
      patient,
      patientUuid,
      visitContext,
      mutateVisitContext: null,
    });

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
              {note.provider.name ? (
                <span> {note.provider.name} · </span>
              ) : null}
              {note.time}
            </p>
          </div>
        ))
      ) : !hasSummary ? (
        <div>
          <p className={styles.emptyText}>
            {t(
              "visitFormNotCompleted",
              "Visit form has not been completed for this visit",
            )}
          </p>
        </div>
      ) : null}
      {canEditVisitNotes ? (
        <Button
          size="sm"
          kind="ghost"
          disabled={!patient || !visitContext?.uuid}
          renderIcon={(props) => <ArrowRight size={16} {...props} />}
          onClick={openVisitSummary}
          iconDescription={t("openVisitSummary", "Open visit summary")}
        >
          {t("openVisitSummary", "Open visit summary")}
        </Button>
      ) : null}
    </div>
  );
};

export default VisitNote;
