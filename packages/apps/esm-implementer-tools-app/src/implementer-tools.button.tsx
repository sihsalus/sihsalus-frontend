import { HeaderGlobalAction } from '@carbon/react';
import { CloseIcon, ToolsIcon, useStore } from '@openmrs/esm-framework';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import React from 'react';
import { useTranslation } from 'react-i18next';

import styles from './implementer-tools.styles.scss';
import { implementerToolsStore, togglePopup } from './store';

const ImplementerToolsButton: React.FC = () => {
  const { t } = useTranslation();
  const { isOpen } = useStore(implementerToolsStore);

  return (
    <RequirePrivilege privilege={['O3 Implementer Tools', 'app:topnav.implementerTools']} hideUnauthorized>
      <HeaderGlobalAction
        aria-label={t('implementerTools', 'Implementer Tools')}
        aria-labelledby="Implementer Tools"
        className={styles.toolStyles}
        onClick={togglePopup}
      >
        {isOpen ? <CloseIcon size={20} /> : <ToolsIcon size={20} />}
      </HeaderGlobalAction>
    </RequirePrivilege>
  );
};

export default ImplementerToolsButton;
