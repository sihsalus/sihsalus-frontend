import { Button, ButtonSet, DataTableSkeleton, Form, Row, Stack } from '@carbon/react';
import { ErrorState, ExtensionSlot, ResponsiveWrapper, showSnackbar, useLayoutType } from '@openmrs/esm-framework';
import { type DefaultPatientWorkspaceProps, EmptyState } from '@openmrs/esm-patient-common-lib';
import classNames from 'classnames';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { assignStudy as assignStudy, useStudiesByConfig, useStudiesByPatient } from '../../api';
import { type DicomStudy, type OrthancConfiguration } from '../../types';
import AssignStudiesTable from '../components/assign-studies-table.component';
import styles from './studies.scss';

interface AssignStudiesWorkspaceProps extends DefaultPatientWorkspaceProps {
  configuration: OrthancConfiguration;
}

const AssignStudiesWorkspace: React.FC<AssignStudiesWorkspaceProps> = ({
  patientUuid,
  configuration,
  closeWorkspace,
}) => {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const patientState = useMemo(() => ({ patientUuid }), [patientUuid]);
  const { mutate } = useStudiesByPatient(patientUuid);

  const {
    data: studiesData,
    error: assignStudyError,
    isLoading: isLoadingStudies,
  } = useStudiesByConfig(configuration, patientUuid);

  async function assignStudyFunction(study: DicomStudy, isAssign: boolean) {
    const abortController = new AbortController();
    try {
      await assignStudy(study.id, patientUuid, isAssign, abortController);
      mutate();
      showSnackbar({
        kind: 'success',
        title: isAssign
          ? t('studyAssigned', 'The study has been successfully assigned')
          : t('removeAssign', 'Assignment of the study is removed'),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      showSnackbar({
        title: isAssign
          ? t('errorAssignStudy', 'An error occurred while assign the study to the patient')
          : t('errorRemoveAssignStudy', 'An error occurred while removing the assigned study from the patient'),
        kind: 'error',
        subtitle: message,
        isLowContrast: false,
      });
    }
  }

  return (
    <>
      <Form className={styles.formContainer} id="assignStudies">
        {isTablet ? (
          <Row className={styles.header}>
            <ExtensionSlot className={styles.content} name="patient-details-header-slot" state={patientState} />
          </Row>
        ) : null}
        {(() => {
          const displayText = t('studiesNoFoundMessage', 'No studies found');
          const headerTitle = t('Studies', 'Studies');

          if (isLoadingStudies) return <DataTableSkeleton role="progressbar" zebra />;

          if (assignStudyError) return <ErrorState error={assignStudyError} headerTitle={headerTitle} />;

          return (
            <Stack gap={2} className={styles.formContent}>
              {studiesData?.studies.length > 0 ? (
                <section>
                  <ResponsiveWrapper>
                    <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
                      <AssignStudiesTable
                        data={studiesData}
                        patientUuid={patientUuid}
                        assignStudyFunction={(study: DicomStudy, isAssign: boolean) =>
                          assignStudyFunction(study, isAssign)
                        }
                      />
                    </div>
                  </ResponsiveWrapper>
                </section>
              ) : (
                <EmptyState displayText={displayText} headerTitle={headerTitle} />
              )}
              <ButtonSet className={classNames(isTablet ? styles.tabletButtons : styles.desktopButtons)}>
                <Button kind="secondary" onClick={() => closeWorkspace()}>
                  {t('close', 'Close')}
                </Button>
              </ButtonSet>
            </Stack>
          );
        })()}
      </Form>
    </>
  );
};

export default AssignStudiesWorkspace;
