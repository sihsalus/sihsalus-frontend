import { SideNavItems, SideNavMenu } from '@carbon/react';
import { ExtensionSlot, useLayoutType } from '@openmrs/esm-framework';
import { registerNavGroup } from '@openmrs/esm-patient-common-lib';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './dashboard-group.scss';

export interface DashboardGroupExtensionProps {
  title: string;
  basePath: string;
  slotName: string;
  isExpanded?: boolean;
  isChild?: boolean;
}

export const DashboardGroupExtension: React.FC<DashboardGroupExtensionProps> = ({
  title,
  slotName,
  basePath,
  isExpanded,
  isChild,
}) => {
  const isTablet = useLayoutType() === 'tablet';
  const { t } = useTranslation();

  useEffect(() => {
    if (slotName && !isChild) {
      registerNavGroup(slotName);
    }
  }, [slotName, isChild]);

  return (
    <SideNavItems className={styles.sideMenuItems} isSideNavExpanded={true}>
      <SideNavMenu
        className={isChild && styles.sideNavMenu}
        large={isTablet}
        defaultExpanded={isExpanded ?? true}
        title={t(title, title)}
      >
        <ExtensionSlot style={{ width: '100%', minWidth: '15rem' }} name={slotName ?? title} state={{ basePath }} />
      </SideNavMenu>
    </SideNavItems>
  );
};
