import { ExtensionSlot, setCurrentVisit, setLeftNav, unsetLeftNav, usePatient } from '@openmrs/esm-framework';
import { getPatientChartStore, useVisitOrOfflineVisit } from '@openmrs/esm-patient-common-lib';
import { ComponentContext } from '@openmrs/esm-react-utils';
import { launchWorkspaceGroup2, useWorkspaces, WorkspaceContainer } from '@openmrs/esm-styleguide';
import classNames from 'classnames';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

import { moduleName, spaBasePath } from '../constants';
import Loader from '../loader/loader.component';
import ChartReview from '../patient-chart/chart-review/chart-review.component';
import SideMenuPanel from '../side-nav/side-menu.component';

import { type LayoutMode } from './chart-review/dashboard-view.component';
import styles from './patient-chart.scss';

type WorkspaceGroupLauncher = typeof launchWorkspaceGroup2;

function launchPatientChartWorkspaceGroup(
  groupName: Parameters<WorkspaceGroupLauncher>[0],
  groupProps: Parameters<WorkspaceGroupLauncher>[1],
) {
  const shellLauncher = (
    globalThis as typeof globalThis & {
      _openmrs_esm_framework?: {
        launchWorkspaceGroup2?: WorkspaceGroupLauncher;
      };
    }
  )._openmrs_esm_framework?.launchWorkspaceGroup2;

  return typeof shellLauncher === 'function'
    ? shellLauncher(groupName, groupProps)
    : launchWorkspaceGroup2(groupName, groupProps);
}

const PatientChart: React.FC = () => {
  const { patientUuid, view: encodedView } = useParams();
  const view = encodedView ? decodeURIComponent(encodedView) : undefined;
  const { isLoading: isLoadingPatient, patient } = usePatient(patientUuid);
  const { currentVisit, mutate: mutateVisitContext } = useVisitOrOfflineVisit(patientUuid);
  const state = useMemo(() => ({ patient, patientUuid }), [patient, patientUuid]);
  const { workspaceWindowState, active } = useWorkspaces();
  const [layoutMode, setLayoutMode] = useState<LayoutMode>();
  const launchedWorkspaceGroupPatientUuid = useRef<string | null>(null);
  const hasVisibleLegacyWorkspace = workspaceWindowState === 'normal' && active;
  const patientChartGroupProps = useMemo(
    () =>
      patientUuid
        ? {
            patient: patient ?? null,
            patientUuid,
            visitContext: currentVisit ?? null,
            mutateVisitContext,
          }
        : null,
    [mutateVisitContext, patient, patientUuid, currentVisit],
  );

  // We are responsible for creating a new offline visit while in offline mode.
  // The patient chart widgets assume that this is handled by the chart itself.
  // We are also the module that holds the offline visit type UUID config.
  // The following hook takes care of the creation.

  // Keep state updated with the current patient. Anything used outside the patient
  // chart (e.g., the current visit is used by the Active Visit Tag used in the
  // patient search) must be updated in the callback, which is called when the patient
  // chart unmounts.
  useEffect(() => {
    return () => {
      setCurrentVisit(null, null);
    };
  }, []);

  useEffect(() => {
    getPatientChartStore().setState({
      patientUuid: patientUuid ?? null,
      patient,
      visitContext: currentVisit,
      mutateVisitContext,
    });
    return () => {
      getPatientChartStore().setState({
        patientUuid: null,
        patient: null,
        visitContext: null,
        mutateVisitContext: null,
      });
    };
  }, [currentVisit, mutateVisitContext, patient, patientUuid]);

  const leftNavBasePath = useMemo(() => spaBasePath.replace(':patientUuid', patientUuid), [patientUuid]);
  useEffect(() => {
    setLeftNav({
      name: 'patient-chart-dashboard-slot',
      basePath: leftNavBasePath,
    });
    return () => unsetLeftNav('patient-chart-dashboard-slot');
  }, [leftNavBasePath]);

  useEffect(() => {
    if (!patientUuid || isLoadingPatient || hasVisibleLegacyWorkspace) {
      return;
    }

    if (launchedWorkspaceGroupPatientUuid.current === patientUuid) {
      return;
    }

    launchedWorkspaceGroupPatientUuid.current = patientUuid;
    void launchPatientChartWorkspaceGroup('patient-chart', patientChartGroupProps);
  }, [hasVisibleLegacyWorkspace, isLoadingPatient, patientChartGroupProps, patientUuid]);

  return (
    <>
      <SideMenuPanel />
      <main className={classNames('omrs-main-content', styles.chartContainer)}>
        <div
          className={classNames(
            styles.innerChartContainer,
            hasVisibleLegacyWorkspace ? styles.closeWorkspace : styles.activeWorkspace,
          )}
        >
          {isLoadingPatient ? (
            <Loader />
          ) : (
            <>
              <aside>
                <ExtensionSlot name="patient-header-slot" state={state} />
                <ExtensionSlot name="patient-highlights-bar-slot" state={state} />
                <ExtensionSlot name="patient-info-slot" state={state} />
              </aside>
              <div className={styles.grid}>
                <div
                  className={classNames(styles.chartReview, {
                    [styles.widthContained]: layoutMode === 'contained',
                  })}
                >
                  <ChartReview {...state} view={view} setDashboardLayoutMode={setLayoutMode} />
                </div>
              </div>
            </>
          )}
        </div>
      </main>
      <ComponentContext.Provider value={{ moduleName, featureName: 'patient-chart' }}>
        <WorkspaceContainer showSiderailAndBottomNav={false} contextKey={patientUuid} />
      </ComponentContext.Provider>
    </>
  );
};

export default PatientChart;
