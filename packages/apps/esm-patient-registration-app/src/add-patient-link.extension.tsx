import { HeaderGlobalAction } from '@carbon/react';
import { UserFollow } from '@carbon/react/icons';
import { navigate } from '@openmrs/esm-framework';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import React from 'react';
import { useTranslation } from 'react-i18next';

import styles from './add-patient-link.scss';
import { moduleName } from './constants';

export default function Root() {
  const { t } = useTranslation(moduleName);
  const addPatient = React.useCallback(
    () => navigate({ to: `${globalThis.getOpenmrsSpaBase()}patient-registration` }),
    [],
  );

  return (
    <RequirePrivilege privilege={['app:adt', 'app:topnav.registerPatient']} hideUnauthorized>
      <HeaderGlobalAction
        aria-label={t('addPatient', 'Add patient')}
        aria-labelledby={t('addPatient', 'Add patient')}
        onClick={addPatient}
        className={styles.slotStyles}
      >
        <UserFollow size={20} />
      </HeaderGlobalAction>
    </RequirePrivilege>
  );
}
