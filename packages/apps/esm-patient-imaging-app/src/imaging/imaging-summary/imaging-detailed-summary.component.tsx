import {
  Button,
  DataTableSkeleton,
  InlineNotification,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tile,
} from '@carbon/react';
import { AddIcon, launchWorkspace } from '@openmrs/esm-framework';
import { type DefaultPatientWorkspaceProps, EmptyDataIllustration, ErrorState } from '@openmrs/esm-patient-common-lib';
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
  const studies = useStudiesByPatient(patientUuid);
  const requests = useRequestsByPatient(patientUuid);
  const launch = (workspace: string) => {
    if (canWrite) launchWorkspace<DefaultPatientWorkspaceProps>(workspace, { patientUuid });
  };
  const empty = (title: string, description: string) => (
    <Tile className={styles.empty}>
      <div aria-hidden="true">
        <EmptyDataIllustration />
      </div>
      <h4>{title}</h4>
      <p>{description}</p>
    </Tile>
  );
  return (
    <section className={styles.summary} aria-label={t('Medical Imaging', 'Medical imaging')}>
      {!isOnline && (
        <InlineNotification
          kind="warning"
          lowContrast
          hideCloseButton
          title={t('imagingOffline', 'Connect to the network to change imaging data or open images.')}
        />
      )}
      <Tabs key={patientUuid}>
        <TabList aria-label={t('imagingSections', 'Imaging sections')} contained>
          <Tab>{t('Studies', 'Studies')}</Tab>
          <Tab>{t('requests', 'Requests')}</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <div className={styles.toolbar}>
              <p>
                {t(
                  'studiesPanelHelp',
                  'View images linked to this patient, link an existing study or upload DICOM files.',
                )}
              </p>
              <div className={styles.actions}>
                <Button kind="tertiary" size="sm" onClick={() => launch(linkStudiesFormWorkspace)} disabled={!canWrite}>
                  {t('linkStudie', 'Link studies')}
                </Button>
                <Button
                  kind="primary"
                  size="sm"
                  renderIcon={AddIcon}
                  onClick={() => launch(uploadStudiesFormWorkspace)}
                  disabled={!canWrite}
                >
                  {t('uploadDicom', 'Upload DICOM')}
                </Button>
              </div>
            </div>
            {studies.isLoading ? (
              <DataTableSkeleton data-testid="studies-loading" role="progressbar" zebra />
            ) : studies.error ? (
              <ErrorState error={studies.error} headerTitle={t('Studies', 'Studies')} />
            ) : studies.data?.length ? (
              <StudiesDetailTable
                isValidating={studies.isValidating}
                studies={studies.data}
                showDeleteButton
                patientUuid={patientUuid}
              />
            ) : (
              empty(
                t('noLinkedStudies', 'No linked studies'),
                t('noLinkedStudiesHelp', 'When a study is linked or uploaded, it will appear here.'),
              )
            )}
          </TabPanel>
          <TabPanel>
            <div className={styles.toolbar}>
              <p>{t('requestsPanelHelp', 'Create imaging requests and follow their progress in the worklist.')}</p>
              <div className={styles.actions}>
                <Button
                  kind="primary"
                  size="sm"
                  renderIcon={AddIcon}
                  onClick={() => launch(addNewRequestWorkspace)}
                  disabled={!canWrite}
                >
                  {t('newImagingRequest', 'New request')}
                </Button>
              </div>
            </div>
            {requests.isLoading ? (
              <DataTableSkeleton data-testid="requests-loading" role="progressbar" zebra />
            ) : requests.error ? (
              <ErrorState error={requests.error} headerTitle={t('requests', 'Requests')} />
            ) : requests.data?.length ? (
              <RequestProcedureTable
                isValidating={requests.isValidating}
                requests={requests.data}
                showDeleteButton
                showCreateButton={false}
                patientUuid={patientUuid}
              />
            ) : (
              empty(
                t('noImagingRequests', 'No imaging requests'),
                t('noImagingRequestsHelp', 'Create a request to schedule an imaging study for this patient.'),
              )
            )}
          </TabPanel>
        </TabPanels>
      </Tabs>
    </section>
  );
}
