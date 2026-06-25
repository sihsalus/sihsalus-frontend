import { ChevronDownIcon, ChevronUpIcon, useStore } from '@openmrs/esm-framework';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import React from 'react';
import { useTranslation } from 'react-i18next';

import styles from './implementer-tools.styles.scss';
import { implementerToolsStore, togglePopup } from './store';

const GlobalImplementerToolsButton: React.FC = () => {
  const { isOpen } = useStore(implementerToolsStore);
  const { t } = useTranslation();

  return (
    <RequirePrivilege privilege={['O3 Implementer Tools', 'app:topnav.implementerTools']} hideUnauthorized>
      <div className={styles.chevronImplementerToolsButton} data-testid="globalImplementerToolsButton">
        <button
          type="button"
          onClick={togglePopup}
          aria-label={t('toggleImplementerTools', 'Toggle Implementer Tools')}
          className={styles.implementerToolsButton}
        >
          {isOpen ? <ChevronDownIcon size={16} /> : <ChevronUpIcon size={16} />}
        </button>
      </div>
    </RequirePrivilege>
  );
};

export default GlobalImplementerToolsButton;
