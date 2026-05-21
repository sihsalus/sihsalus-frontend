import { Home } from '@carbon/react/icons';
import { ExtensionSlot } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';

import OfflineToolsNavLink from './offline-tools-nav-link.component';

const OfflineToolsNavMenu: React.FC = () => {
  const { t } = useTranslation();
  return (
    <>
      <OfflineToolsNavLink icon={Home} title={t('home', 'Home')} />
      <ExtensionSlot name="offline-tools-page-slot" />
    </>
  );
};

export default OfflineToolsNavMenu;
