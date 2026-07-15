import { Button } from '@carbon/react';
import { Add } from '@carbon/react/icons';
import React, { useCallback } from 'react';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import { useMaternalFormIdentifierLauncher } from '../../hooks/useMaternalFormLauncher';

type ConfiguredFormButtonProps = {
  formUuid: string;
  label: string;
  editPrivilege: string;
};

const ConfiguredFormButton: React.FC<ConfiguredFormButtonProps> = ({ formUuid, label, editPrivilege }) => {
  const { launchForm } = useMaternalFormIdentifierLauncher(formUuid, label);
  const handleLaunchForm = useCallback(() => {
    launchForm();
  }, [launchForm]);

  return (
    <RequirePrivilege privilege={editPrivilege} hideUnauthorized>
      <Button kind="ghost" size="sm" renderIcon={Add} onClick={handleLaunchForm} iconDescription={label}>
        {label}
      </Button>
    </RequirePrivilege>
  );
};

export default ConfiguredFormButton;
