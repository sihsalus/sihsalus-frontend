import { Button } from '@carbon/react';
import { Add } from '@carbon/react/icons';
import { launchWorkspace2 } from '@openmrs/esm-framework';
import React, { useCallback } from 'react';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import { formEntryWorkspace } from '../../types';

type ConfiguredFormButtonProps = {
  formUuid: string;
  label: string;
  editPrivilege: string;
};

const ConfiguredFormButton: React.FC<ConfiguredFormButtonProps> = ({ formUuid, label, editPrivilege }) => {
  const handleLaunchForm = useCallback(() => {
    if (!formUuid) {
      console.warn('Form UUID not configured');
      return;
    }

    launchWorkspace2(formEntryWorkspace, {
      form: { uuid: formUuid },
      encounterUuid: '',
    });
  }, [formUuid]);

  return (
    <RequirePrivilege privilege={editPrivilege} hideUnauthorized>
      <Button kind="ghost" size="sm" renderIcon={Add} onClick={handleLaunchForm} iconDescription={label}>
        {label}
      </Button>
    </RequirePrivilege>
  );
};

export default ConfiguredFormButton;
