import { HeaderGlobalAction } from '@carbon/react';
import { Merge } from '@carbon/react/icons';
import { navigate, useSession } from '@openmrs/esm-framework';
import { AppErrorBoundary } from '@sihsalus/esm-rbac';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { admissionPrivilege, basePath, moduleName } from '../constants';
import styles from './links.scss';

export default function AdmissionMergePatientsAction() {
  const session = useSession();
  const { t } = useTranslation(moduleName);
  const openMergePatients = useCallback(
    () => navigate({ to: `${globalThis.getOpenmrsSpaBase().slice(0, -1)}${basePath}/merge` }),
    [],
  );

  return (
    <AppErrorBoundary
      appName="esm-admission-app"
      checkAccess={true}
      privilegesRequired={[admissionPrivilege]}
      user={session}
      disappear={true}
    >
      <HeaderGlobalAction
        aria-label={t('mergeDuplicatePatients', 'Fusionar historias clinicas duplicadas')}
        aria-labelledby={t('mergeDuplicatePatients', 'Fusionar historias clinicas duplicadas')}
        onClick={openMergePatients}
        className={styles.action}
      >
        <Merge size={20} />
      </HeaderGlobalAction>
    </AppErrorBoundary>
  );
}
