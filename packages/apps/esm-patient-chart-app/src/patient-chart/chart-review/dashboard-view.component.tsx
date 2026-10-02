import { Extension, ExtensionSlot, useExtensionSlotMeta } from '@openmrs/esm-framework';
import { launchPatientWorkspace, launchStartVisitPrompt } from '@openmrs/esm-patient-common-lib';
import classNames from 'classnames';
import { useMemo } from 'react';
import { useMatch } from 'react-router-dom';

import { dashboardPath } from '../../constants';

import styles from './dashboard-view.scss';

/**
 * The layout mode dictates the width occuppied by the chart dashboard widgets.
 * - In 'contained' mode, the dashboard widgets are displayed in a centered
 * container with a fixed width (max-width: 60rem).
 * - In 'anchored' mode, the dashboard widgets expand to occupy the entire width
 * of the chart dashboard
 */
export type LayoutMode = 'contained' | 'anchored';

export interface DashboardConfig {
  slot: string;
  title: string | (() => string | Promise<string>);
  path: string;
  layoutMode?: LayoutMode;
  moduleName: string;
}

interface DashboardViewProps {
  dashboard: DashboardConfig;
  patientUuid: string;
  patient: fhir.Patient;
}

export function DashboardView({ dashboard, patientUuid, patient }: DashboardViewProps) {
  const widgetMetas = useExtensionSlotMeta(dashboard.slot);
  const match = useMatch(dashboardPath);
  const view = match?.params?.view;

  const state = useMemo(
    () => ({
      basePath: view,
      patient,
      patientUuid,
      launchPatientWorkspace,
      launchStartVisitPrompt,
    }),
    [patient, patientUuid, view],
  );

  return (
    <>
      <ExtensionSlot state={state} name="top-of-all-patient-dashboards-slot" />
      <div className={styles.dashboardContainer}>
        <ExtensionSlot key={dashboard.slot} name={dashboard.slot} className={styles.dashboard}>
          {(extension) => {
            const { fullWidth = false } = widgetMetas[extension.id] || {};
            return (
              <div className={classNames(styles.extension, fullWidth && styles.fullWidth)}>
                <Extension state={state} className={styles.extensionWrapper} />
              </div>
            );
          }}
        </ExtensionSlot>
      </div>
    </>
  );
}
