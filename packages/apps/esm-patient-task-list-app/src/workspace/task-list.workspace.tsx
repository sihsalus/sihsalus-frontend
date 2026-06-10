import { Button } from '@carbon/react';
import { Add, ArrowLeft } from '@carbon/react/icons';
import { type Visit, Workspace2 } from '@openmrs/esm-framework';
import { type PatientWorkspace2DefinitionProps } from '@openmrs/esm-patient-common-lib';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AddTaskForm from './add-task-form.component';
import TaskDetailsView from './task-details-view.component';
import { type Task } from './task-list.resource';
import styles from './task-list.scss';
import TaskListView from './task-list-view.component';

type View = 'list' | 'form' | 'details' | 'edit';

const TaskListWorkspace: React.FC<PatientWorkspace2DefinitionProps<{}, {}>> = ({ groupProps }) => {
  const { patientUuid, visitContext } = groupProps ?? { patientUuid: '', visitContext: undefined as unknown as Visit };
  const { t } = useTranslation();
  const [view, setView] = useState<View>('list');
  const [selectedTaskUuid, setSelectedTaskUuid] = useState<string | null>(null);

  const handleTaskClick = (task: Task) => {
    setSelectedTaskUuid(task.uuid);
    setView('details');
  };

  const handleEdit = (task: Task) => {
    setSelectedTaskUuid(task.uuid);
    setView('edit');
  };

  const handleEditComplete = () => {
    setView('details');
  };

  const handleBackClick = () => {
    if (view === 'edit') {
      setView('details');
      return;
    }
    setView('list');
    setSelectedTaskUuid(null);
  };

  const backText =
    view === 'edit' ? t('backToTaskDetails', 'Back to task details') : t('backToTaskList', 'Back to task list');

  return (
    <Workspace2 title={t('taskListWorkspaceTitle', 'Task List')}>
      <div className={styles.workspaceContainer}>
        {['form', 'details', 'edit'].includes(view) && (
          <div className={styles.backButton}>
            <Button
              kind="ghost"
              renderIcon={(props) => <ArrowLeft size={16} {...props} />}
              iconDescription={backText}
              onClick={handleBackClick}
            >
              <span>{backText}</span>
            </Button>
          </div>
        )}
        {view === 'form' && (
          <AddTaskForm patientUuid={patientUuid} activeVisit={visitContext} onClose={() => setView('list')} />
        )}
        {view === 'list' && <TaskListView patientUuid={patientUuid} onTaskClick={handleTaskClick} />}
        {view === 'list' && (
          <div className={styles.addTaskButtonContainer}>
            <Button
              kind="ghost"
              renderIcon={(props) => <Add size={16} {...props} />}
              iconDescription={t('addTask', 'Add Task')}
              onClick={() => setView('form')}
            >
              {t('addTask', 'Add Task')}
            </Button>
          </div>
        )}
        {view === 'details' && selectedTaskUuid && (
          <TaskDetailsView
            patientUuid={patientUuid}
            taskUuid={selectedTaskUuid}
            onBack={handleBackClick}
            onEdit={handleEdit}
          />
        )}
        {view === 'edit' && selectedTaskUuid && (
          <AddTaskForm
            patientUuid={patientUuid}
            activeVisit={visitContext}
            onClose={handleEditComplete}
            editTaskUuid={selectedTaskUuid}
          />
        )}
      </div>
    </Workspace2>
  );
};

export default TaskListWorkspace;
