import { OverflowMenuItem } from '@carbon/react';
import { navigate } from '@openmrs/esm-framework';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { careLogbookBasePath, careLogbookMergePrivileges, moduleName } from '../constants';

interface CareLogbookMergePatientsMenuItemProps {
  closeMenu?: () => void;
}

export default function CareLogbookMergePatientsMenuItem({ closeMenu }: CareLogbookMergePatientsMenuItemProps) {
  const { t } = useTranslation(moduleName);
  const openMergePatients = useCallback(
    () => navigate({ to: `${globalThis.getOpenmrsSpaBase().slice(0, -1)}${careLogbookBasePath}/merge` }),
    [],
  );

  return (
    <RequirePrivilege privilege={careLogbookMergePrivileges} hideUnauthorized>
      <OverflowMenuItem
        itemText={t('mergeDuplicatePatients', 'Fusionar historias duplicadas')}
        onClick={openMergePatients}
        closeMenu={closeMenu}
      />
    </RequirePrivilege>
  );
}
