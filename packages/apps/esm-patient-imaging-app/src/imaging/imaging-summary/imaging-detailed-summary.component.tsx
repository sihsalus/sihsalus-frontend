import { Button, DataTableSkeleton, InlineNotification, Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import { AddIcon, launchWorkspace } from '@openmrs/esm-framework';
import { type DefaultPatientWorkspaceProps, EmptyState, ErrorState } from '@openmrs/esm-patient-common-lib';
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
        <TabList aria-label={t('imagingSections', 'Imaging sections')}>
          <Tab>{t('Studies', 'Studies')}</Tab>
          <Tab>{t('requests', 'Requests')}</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <div className={styles.actions}>
              <Button
                kind="ghost"
                size="sm"
                renderIcon={AddIcon}
                onClick={() => launch(linkStudiesFormWorkspace)}
                disabled={!canWrite}
              >
                {t('linkStudie', 'Link studies')}
              </Button>
              <Button
                kind="ghost"
                size="sm"
                renderIcon={AddIcon}
                onClick={() => launch(uploadStudiesFormWorkspace)}
                disabled={!canWrite}
              >
                {t('uploadDicom', 'Upload DICOM')}
              </Button>
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
              <EmptyState displayText={t('Studies', 'Studies')} headerTitle={t('Studies', 'Studies')} />
            )}
          </TabPanel>
          <TabPanel>
            {requests.isLoading ? (
              <DataTableSkeleton data-testid="requests-loading" role="progressbar" zebra />
            ) : requests.error ? (
              <ErrorState error={requests.error} headerTitle={t('requests', 'Requests')} />
            ) : requests.data?.length ? (
              <>
                <div className={styles.actions}>
                  <Button
                    kind="ghost"
                    size="sm"
                    renderIcon={AddIcon}
                    onClick={() => launch(addNewRequestWorkspace)}
                    disabled={!canWrite}
                  >
                    {t('Add', 'Add')}
                  </Button>
                </div>
                <RequestProcedureTable
                  isValidating={requests.isValidating}
                  requests={requests.data}
                  showDeleteButton
                  showCreateButton={false}
                  patientUuid={patientUuid}
                />
              </>
            ) : (
              <EmptyState
                displayText={t('requests', 'Requests')}
                headerTitle={t('requests', 'Requests')}
                launchForm={canWrite ? () => launch(addNewRequestWorkspace) : undefined}
              />
            )}
          </TabPanel>
        </TabPanels>
      </Tabs>
    </section>
  );
}
