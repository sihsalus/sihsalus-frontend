import { Button, Search } from '@carbon/react';
import { Logout } from '@carbon/react/icons';
import { AssignedExtension, Extension, navigate, useConnectedExtensions } from '@openmrs/esm-framework';
import { ComponentContext } from '@openmrs/esm-framework/src/internal';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './app-module-switcher.scss';

const AppModuleSwitcher: React.FC = () => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const extensions = useConnectedExtensions('app-menu-item-slot') as AssignedExtension[];

  const handleLogout = useCallback(() => {
    navigate({ to: `${globalThis.getOpenmrsSpaBase()}logout` });
  }, []);

  const filtered = searchTerm
    ? extensions.filter((ext) => ext.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : extensions;

  return (
    <div className={styles.overlay}>
      <Search
        autoFocus
        className={styles.searchInput}
        closeButtonLabelText={t('clear', 'Borrar')}
        labelText=""
        onChange={(e) => setSearchTerm(e.target.value)}
        onClear={() => setSearchTerm('')}
        placeholder={t('searchModule', 'Buscar módulo...')}
        size="lg"
        value={searchTerm}
      />
      <div className={styles.cardGrid}>
        {filtered.map((ext) => (
          <ComponentContext.Provider
            key={ext.id}
            value={{
              featureName: ext.name,
              moduleName: ext.moduleName,
              extension: {
                extensionId: ext.id,
                extensionSlotName: 'app-menu-item-slot',
                extensionSlotModuleName: ext.moduleName,
              },
            }}
          >
            <Extension />
          </ComponentContext.Provider>
        ))}
      </div>
      <div className={styles.footer}>
        <Button className={styles.logoutButton} kind="ghost" onClick={handleLogout} renderIcon={Logout} size="md">
          {t('logout', 'Cerrar sesión')}
        </Button>
      </div>
    </div>
  );
};

export default AppModuleSwitcher;
