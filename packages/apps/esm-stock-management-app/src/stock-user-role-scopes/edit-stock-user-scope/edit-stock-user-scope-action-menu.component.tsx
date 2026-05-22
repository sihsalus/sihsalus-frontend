import { IconButton } from '@carbon/react';
import { Edit } from '@carbon/react/icons';
import { launchWorkspace } from '@openmrs/esm-framework';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { type UserRoleScope } from '../../core/api/types/identity/UserRoleScope';

interface EditStockUserRoleActionsMenuProps {
  data: UserRoleScope;
}

const EditStockUserRoleActionsMenu: React.FC<EditStockUserRoleActionsMenuProps> = ({ data }) => {
  const { t } = useTranslation();

  const handleLaunchWorkspace = useCallback(() => {
    launchWorkspace<{ model?: UserRoleScope }>('stock-user-role-scopes-form-workspace', {
      workspaceTitle: t('editUserRoleScope', 'Edit user role scope'),
      model: data,
    });
  }, [data, t]);

  return (
    <IconButton
      autoAlign
      kind="ghost"
      label={t('editUserRoleScope', 'Edit user role scope')}
      onClick={handleLaunchWorkspace}
    >
      <Edit size={16} />
    </IconButton>
  );
};
export default EditStockUserRoleActionsMenu;
