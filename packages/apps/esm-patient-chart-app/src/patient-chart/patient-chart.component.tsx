import {
  ExtensionSlot,
  setCurrentVisit,
  setLeftNav,
  showSnackbar,
  unsetLeftNav,
  usePatient,
} from '@openmrs/esm-framework';
import {
  getPatientChartStore,
  type PatientWorkspaceGroupProps,
  useVisitOrOfflineVisit,
} from '@openmrs/esm-patient-common-lib';
import { ComponentContext } from '@openmrs/esm-react-utils';
import { launchWorkspaceGroup2, useWorkspaces, WorkspaceContainer } from '@openmrs/esm-styleguide';
import classNames from 'classnames';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

import { moduleName, spaBasePath } from '../constants';
import Loader from '../loader/loader.component';
import ChartReview from '../patient-chart/chart-review/chart-review.component';
import SideMenuPanel from '../side-nav/side-menu.component';

import { type LayoutMode } from './chart-review/dashboard-view.component';
import styles from './patient-chart.scss';

type WorkspaceGroupLauncher = typeof launchWorkspaceGroup2;
type PatientChartWorkspaceGroupProps = PatientWorkspaceGroupProps | null;
type WorkspaceGroupLaunchKey = {
  patientUuid: string | null;
  visitContextUuid: string | null;
};

function getWorkspaceGroupLaunchKey(groupProps: PatientChartWorkspaceGroupProps | null): WorkspaceGroupLaunchKey {
  return {
    patientUuid: groupProps?.patientUuid ?? null,
    visitContextUuid: groupProps?.visitContext?.uuid ?? null,
  };
}

function workspaceGroupLaunchKeysEqual(a: WorkspaceGroupLaunchKey | null, b: WorkspaceGroupLaunchKey | null) {
  return a?.patientUuid === b?.patientUuid && a?.visitContextUuid === b?.visitContextUuid;
}

async function launchPatientChartWorkspaceGroup(
  groupName: Parameters<WorkspaceGroupLauncher>[0],
  groupProps: PatientChartWorkspaceGroupProps,
): Promise<boolean> {
  const shellLauncher = (
    globalThis as typeof globalThis & {
      _openmrs_esm_framework?: {
        launchWorkspaceGroup2?: WorkspaceGroupLauncher;
      };
    }
  )._openmrs_esm_framework?.launchWorkspaceGroup2;

  const launcher = typeof shellLauncher === 'function' ? shellLauncher : launchWorkspaceGroup2;

  return Boolean(await launcher(groupName, groupProps));
}

const PatientChart: React.FC = () => {
  const { patientUuid, view: encodedView } = useParams();
  const view = encodedView ? decodeURIComponent(encodedView) : undefined;
  const { isLoading: isLoadingPatient, patient } = usePatient(patientUuid);
  const { currentVisit, mutate: mutateVisitContext } = useVisitOrOfflineVisit(patientUuid);
  const state = useMemo(() => ({ patient, patientUuid }), [patient, patientUuid]);
  const { workspaceWindowState, active } = useWorkspaces();
  const [layoutMode, setLayoutMode] = useState<LayoutMode>();
  const launchedWorkspaceGroupKey = useRef<WorkspaceGroupLaunchKey | null>(null);
  const latestWorkspaceGroupProps = useRef<PatientChartWorkspaceGroupProps | null>(null);
  const isWorkspaceGroupLaunchPending = useRef(false);
  const isMounted = useRef(false);
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
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const launchLatestWorkspaceGroup = useCallback(async () => {
    if (isWorkspaceGroupLaunchPending.current) {
      return;
    }

    isWorkspaceGroupLaunchPending.current = true;

    try {
      let needsLaunch = true;
      while (needsLaunch) {
        const groupProps = latestWorkspaceGroupProps.current;
        const launchKey = getWorkspaceGroupLaunchKey(groupProps);

        if (workspaceGroupLaunchKeysEqual(launchKey, launchedWorkspaceGroupKey.current)) {
          needsLaunch = false;
          continue;
        }

        if (!isMounted.current) {
          return;
        }

        const launched = await launchPatientChartWorkspaceGroup('patient-chart', groupProps);

        if (!isMounted.current) {
          return;
        }

        if (!launched) {
          needsLaunch = false;
          continue;
        }

        launchedWorkspaceGroupKey.current = launchKey;

        const latestLaunchKey = getWorkspaceGroupLaunchKey(latestWorkspaceGroupProps.current);
        if (workspaceGroupLaunchKeysEqual(latestLaunchKey, launchedWorkspaceGroupKey.current)) {
          needsLaunch = false;
        }
      }
    } finally {
      isWorkspaceGroupLaunchPending.current = false;
    }
  }, []);

  useEffect(() => {
    if (!patientUuid || isLoadingPatient || hasVisibleLegacyWorkspace) {
      return;
    }

    latestWorkspaceGroupProps.current = patientChartGroupProps;
    void launchLatestWorkspaceGroup().catch((error) => {
      showSnackbar({
        kind: 'error',
        title: 'Error launching workspace group',
        subtitle: error?.message,
        isLowContrast: false,
      });
    });
  }, [hasVisibleLegacyWorkspace, isLoadingPatient, launchLatestWorkspaceGroup, patientChartGroupProps, patientUuid]);

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
