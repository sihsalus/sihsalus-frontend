import { HeaderGlobalAction } from '@carbon/react';
import { Merge } from '@carbon/react/icons';
import { navigate } from '@openmrs/esm-framework';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { careLogbookBasePath, careLogbookMergePrivileges, moduleName } from '../constants';
import styles from './links.scss';

export default function CareLogbookMergePatientsAction() {
  const { t } = useTranslation(moduleName);
  const openMergePatients = useCallback(
    () => navigate({ to: `${globalThis.getOpenmrsSpaBase().slice(0, -1)}${careLogbookBasePath}/merge` }),
    [],
  );

  return (
    <RequirePrivilege privilege={careLogbookMergePrivileges} hideUnauthorized>
      <HeaderGlobalAction
        aria-label={t('mergeDuplicatePatients', 'Fusionar historias clínicas duplicadas')}
        aria-labelledby={t('mergeDuplicatePatients', 'Fusionar historias clínicas duplicadas')}
        onClick={openMergePatients}
        className={styles.action}
      >
        <Merge size={20} />
      </HeaderGlobalAction>
    </RequirePrivilege>
  );
}
