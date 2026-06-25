import { OverflowMenuItem } from '@carbon/react';
import { navigate } from '@openmrs/esm-framework';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { basePath, careLogbookEditPrivilege, moduleName } from '../constants';

interface CareLogbookMergePatientsMenuItemProps {
  closeMenu?: () => void;
}

export default function CareLogbookMergePatientsMenuItem({ closeMenu }: CareLogbookMergePatientsMenuItemProps) {
  const { t } = useTranslation(moduleName);
  const openMergePatients = useCallback(
    () => navigate({ to: `${globalThis.getOpenmrsSpaBase().slice(0, -1)}${basePath}/merge` }),
    [],
  );

  return (
    <RequirePrivilege privilege={careLogbookEditPrivilege} hideUnauthorized>
      <OverflowMenuItem
        itemText={t('mergeDuplicatePatients', 'Fusionar historias duplicadas')}
        onClick={openMergePatients}
        closeMenu={closeMenu}
      />
    </RequirePrivilege>
  );
}
