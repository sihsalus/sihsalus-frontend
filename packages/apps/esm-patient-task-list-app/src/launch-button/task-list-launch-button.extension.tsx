import { ActionMenuButton2, ListCheckedIcon } from '@openmrs/esm-framework';
import React, { type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

const TaskListActionButton: React.FC = () => {
  const { t } = useTranslation();

  return (
    <ActionMenuButton2
      icon={(props: ComponentProps<typeof ListCheckedIcon>) => <ListCheckedIcon {...props} />}
      label={t('taskList', 'Task list')}
      workspaceToLaunch={{
        workspaceName: 'task-list',
        workspaceProps: {},
      }}
    />
  );
};

export default TaskListActionButton;
