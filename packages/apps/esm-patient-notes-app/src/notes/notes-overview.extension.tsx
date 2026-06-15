import { Button, DataTableSkeleton, InlineLoading } from '@carbon/react';
import { AddIcon, launchWorkspace, useLayoutType } from '@openmrs/esm-framework';
import {
  CardHeader,
  EmptyState,
  ErrorState,
  launchStartVisitPrompt,
  usePatientChartStore,
} from '@openmrs/esm-patient-common-lib';
import React, { type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './notes-overview.scss';
import PaginatedNotes from './paginated-notes.component';
import { useVisitNotes } from './visit-notes.resource';

interface NotesOverviewProps {
  patientUuid?: string;
  patient?: fhir.Patient;
  basePath?: string;
}

/**
 * This extension uses the patient chart store and MUST only be mounted within the patient chart
 */
const NotesOverview: React.FC<NotesOverviewProps> = ({ patientUuid, patient, basePath: _basePath }) => {
  const pageSize = 5;
  const { t } = useTranslation();
  const { patientUuid: storedPatientUuid, patient: storedPatient, visitContext } = usePatientChartStore(patientUuid);
  const resolvedPatientUuid = patientUuid ?? storedPatientUuid ?? '';
  const resolvedPatient = patient ?? storedPatient;
  const pageUrl = `${globalThis.spaBase}/patient/${resolvedPatient?.id ?? resolvedPatientUuid}/chart/Forms & Notes`;
  const urlLabel = t('seeAll', 'See all');
  const displayText = t('visitNotes', 'Visit notes');
  const headerTitle = t('visitNotes', 'Visit notes');
  const { visitNotes, error, isLoading, isValidating } = useVisitNotes(resolvedPatientUuid);
  const _layout = useLayoutType();
  const _isDesktop = _layout === 'large-desktop' || _layout === 'small-desktop';

  const launchVisitNoteForm = React.useCallback(() => {
    if (visitContext) {
      launchWorkspace('visit-notes-form-workspace');
    } else {
      launchStartVisitPrompt();
    }
  }, [visitContext]);

  if (!resolvedPatientUuid) {
    return null;
  }

  if (isLoading) {
    return <DataTableSkeleton role="progressbar" zebra />;
  }
  if (error) {
    return <ErrorState error={error} headerTitle={headerTitle} />;
  }
  if (!visitNotes?.length) {
    return <EmptyState displayText={displayText} headerTitle={headerTitle} launchForm={launchVisitNoteForm} />;
  }

  return (
    <div className={styles.widgetCard}>
      <CardHeader title={headerTitle}>
        <span>{isValidating ? <InlineLoading /> : null}</span>
        <Button
          kind="ghost"
          renderIcon={(props: ComponentProps<typeof AddIcon>) => <AddIcon size={16} {...props} />}
          iconDescription="Add visit note"
          onClick={launchVisitNoteForm}
        >
          {t('add', 'Add')}
        </Button>
      </CardHeader>
      <PaginatedNotes notes={visitNotes} pageSize={pageSize} urlLabel={urlLabel} pageUrl={pageUrl} />
    </div>
  );
};

export default NotesOverview;
