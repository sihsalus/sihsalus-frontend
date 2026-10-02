import { Button, DataTableSkeleton, InlineNotification } from '@carbon/react';
import { AddIcon, launchWorkspace } from '@openmrs/esm-framework';
import { CardHeader, type DefaultPatientWorkspaceProps, EmptyState, ErrorState } from '@openmrs/esm-patient-common-lib';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useRequestsByPatient, useStudiesByPatient } from '../../api';
import RequestProcedureTable from '../components/requests-details-table.component';
import StudiesDetailTable from '../components/studies-details-table.component';
import { addNewRequestWorkspace, linkStudiesFormWorkspace, uploadStudiesFormWorkspace } from '../constants';
import { useImagingAccess } from '../utils/use-imaging-access';
import styles from './imaging-detailed-summary.scss';

interface ImagingDetailedSummaryProps {
  patientUuid: string;
}

export default function ImagingDetailedSummary({ patientUuid }: ImagingDetailedSummaryProps) {
  const { t } = useTranslation();
  const { canWrite, isOnline } = useImagingAccess();
  const launchUploadStudiesWorkspace = useCallback(
    () => launchWorkspace<DefaultPatientWorkspaceProps>(uploadStudiesFormWorkspace, { patientUuid }),
    [patientUuid],
  );
  const launchLinkStudiesWorkspace = useCallback(
    () => launchWorkspace<DefaultPatientWorkspaceProps>(linkStudiesFormWorkspace, { patientUuid }),
    [patientUuid],
  );
  const launchAddRequestWorkspace = useCallback(
    () => launchWorkspace<DefaultPatientWorkspaceProps>(addNewRequestWorkspace, { patientUuid }),
    [patientUuid],
  );
  const headerTitle = t('managerStudies', 'Manage studies');

  const {
    data: studies,
    error: studiesError,
    isLoading: isLoadingPatientStudies,
    isValidating: isValidatingStudies,
  } = useStudiesByPatient(patientUuid);

  const {
    data: requests,
    error: requestError,
    isLoading: isLoadingRequests,
    isValidating: isValidatingRequest,
  } = useRequestsByPatient(patientUuid);

  return (
    <div className={styles.summary}>
      {!isOnline && (
        <InlineNotification
          kind="warning"
          lowContrast
          hideCloseButton
          title={t('imagingOffline', 'Connect to the network to change imaging data or open images.')}
        />
      )}
      <section>
        <div className={styles.managementHeader}>
          <CardHeader title={headerTitle}>
            <div className={styles.actions}>
              <Button
                kind="ghost"
                renderIcon={(props) => <AddIcon size={16} {...props} />}
                iconDescription={t('linkStudies', 'Studies')}
                onClick={launchLinkStudiesWorkspace}
                disabled={!canWrite}
              >
                <strong>{t('linkStudie', 'Link studies')}</strong>
              </Button>
              <Button
                kind="ghost"
                renderIcon={(props) => <AddIcon size={16} {...props} />}
                iconDescription={t('upload', 'Upload')}
                onClick={launchUploadStudiesWorkspace}
                disabled={!canWrite}
              >
                <strong>{t('upload', 'Upload')}</strong>
              </Button>
            </div>
          </CardHeader>
        </div>
        {(() => {
          const displayTextStudies = t('Studies', 'Studies');
          const headerTitle = t('Studies', 'Studies');

          if (isLoadingPatientStudies)
            return <DataTableSkeleton data-testid="studies-loading" role="progressbar" zebra />;

          if (studiesError) return <ErrorState error={studiesError} headerTitle={headerTitle} />;

          if (studies?.length) {
            return (
              <StudiesDetailTable
                isValidating={isValidatingStudies}
                studies={studies}
                showDeleteButton={true}
                patientUuid={patientUuid}
              />
            );
          }
          return (
            <EmptyState
              displayText={displayTextStudies}
              headerTitle={headerTitle}
              launchForm={canWrite ? launchUploadStudiesWorkspace : undefined}
            />
          );
        })()}
      </section>
      <section>
        {(() => {
          const displayTextWorklist = t('requests', 'Requests');
          const headerTitle = t('worklist', 'Worklist');

          if (isLoadingRequests) return <DataTableSkeleton role="progressbar" zebra />;

          if (requestError) return <ErrorState error={requestError} headerTitle={headerTitle} />;
          if (requests?.length > 0) {
            return (
              <RequestProcedureTable
                isValidating={isValidatingRequest}
                requests={requests}
                showDeleteButton={true}
                patientUuid={patientUuid}
              />
            );
          }
          return (
            <EmptyState
              displayText={displayTextWorklist}
              headerTitle={headerTitle}
              launchForm={canWrite ? launchAddRequestWorkspace : undefined}
            />
          );
        })()}
      </section>
    </div>
  );
}
