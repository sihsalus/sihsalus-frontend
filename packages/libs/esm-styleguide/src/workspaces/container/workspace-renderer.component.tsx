import { InlineLoading } from '@carbon/react';
import { getCoreTranslation } from '@openmrs/esm-translations';
import { useEffect, useMemo, useState } from 'react';
import { mountRootParcel, type ParcelConfig } from 'single-spa';
import Parcel from 'single-spa-react/parcel';
import { useWorkspaceGroupStore } from '../workspace-sidebar-store/useWorkspaceGroupStore';
import { type OpenWorkspace } from '../workspaces';
import styles from './workspace.module.scss';

interface WorkspaceRendererProps {
  workspace: OpenWorkspace;
  additionalPropsFromPage?: object;
}

export function WorkspaceRenderer({ workspace, additionalPropsFromPage }: WorkspaceRendererProps) {
  const [lifecycle, setLifecycle] = useState<ParcelConfig | undefined>();
  const workspaceGroupState = useWorkspaceGroupStore(workspace.currentWorkspaceGroup);

  useEffect(() => {
    let active = true;
    workspace.load().then((lifecycle) => {
      if (active) {
        setLifecycle(lifecycle);
      }
    });
    return () => {
      active = false;
    };
  }, [workspace]);

  const props = useMemo(
    () =>
      workspace && {
        closeWorkspace: workspace.closeWorkspace,
        closeWorkspaceWithSavedChanges: workspace.closeWorkspaceWithSavedChanges,
        promptBeforeClosing: workspace.promptBeforeClosing,
        setTitle: workspace.setTitle,
        ...additionalPropsFromPage,
        ...workspaceGroupState,
        ...workspace.additionalProps,
      },
    [workspace, additionalPropsFromPage, workspaceGroupState],
  );

  return lifecycle ? (
    <Parcel key={workspace.name} config={lifecycle} mountParcel={mountRootParcel} {...props} />
  ) : (
    <InlineLoading className={styles.loader} description={`${getCoreTranslation('loading', 'Loading')} ...`} />
  );
}
