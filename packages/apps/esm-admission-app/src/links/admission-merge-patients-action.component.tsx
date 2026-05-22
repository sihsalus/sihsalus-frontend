import { HeaderGlobalAction } from '@carbon/react';
import { Merge } from '@carbon/react/icons';
import { navigate } from '@openmrs/esm-framework';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { basePath, moduleName } from '../constants';
import styles from './links.scss';

export default function AdmissionMergePatientsAction() {
  const { t } = useTranslation(moduleName);
  const openMergePatients = useCallback(
    () => navigate({ to: `${globalThis.getOpenmrsSpaBase().slice(0, -1)}${basePath}/merge` }),
    [],
  );

  return (
    <HeaderGlobalAction
      aria-label={t('mergeDuplicatePatients', 'Fusionar historias clínicas duplicadas')}
      aria-labelledby={t('mergeDuplicatePatients', 'Fusionar historias clínicas duplicadas')}
      onClick={openMergePatients}
      className={styles.action}
    >
      <Merge size={20} />
    </HeaderGlobalAction>
  );
}
