import { ExtensionSlot } from '@openmrs/esm-framework';
import { GroupFormWorkflowProvider } from '../context/group-form-workflow-context';
import GroupSessionWorkspace from './group-session-workspace';
import GroupDisplayHeader from './group-display-header';
import GroupSearchHeader from './group-search-header';
import SessionMetaWorkspace from './session-meta-workspace';
import styles from './styles.scss';

const GroupFormEntryWorkflow = () => {
  return (
    <GroupFormWorkflowProvider>
      <div className={styles.breadcrumbsContainer}>
        <ExtensionSlot name="breadcrumbs-slot" />
      </div>
      <GroupSearchHeader />
      <GroupDisplayHeader />
      <div className={styles.workspaceWrapper}>
        <SessionMetaWorkspace />
        <GroupSessionWorkspace />
      </div>
    </GroupFormWorkflowProvider>
  );
};

export default GroupFormEntryWorkflow;
