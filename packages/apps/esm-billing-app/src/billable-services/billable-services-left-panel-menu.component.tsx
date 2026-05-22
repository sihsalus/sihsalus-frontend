import { SideNavMenu, SideNavMenuItem } from '@carbon/react';
import { navigate, UserHasAccess } from '@openmrs/esm-framework';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, useLocation } from 'react-router-dom';

export interface BillableServicesMenuConfig {
  title: string;
  icon?: React.ComponentType<any>;
  privilege?: string;
  items: Array<{
    name: string;
    title: string;
    path: string;
  }>;
}

function BillableServicesMenuExtension({ config }: { config: BillableServicesMenuConfig }) {
  const { title, icon: Icon, items, privilege } = config;
  const { t } = useTranslation();
  const location = useLocation();
  const spaBasePath = `${globalThis.spaBase}/billable-services`;

  const activePath = useMemo(
    () => location.pathname.replace(spaBasePath, '').replace(/^\//, ''),
    [location.pathname, spaBasePath],
  );

  const handleNavigation = (path: string) => {
    navigate({ to: `${spaBasePath}/${path}` });
  };

  const menu = (
    <SideNavMenu defaultExpanded title={t(title)} renderIcon={Icon}>
      {items.map((item) => (
        <SideNavMenuItem
          key={item.name}
          isActive={activePath === item.path}
          onClick={() => handleNavigation(item.path)}
        >
          <span className="sihsalus-side-nav__text">{t(item.title)}</span>
        </SideNavMenuItem>
      ))}
    </SideNavMenu>
  );

  if (privilege) {
    return <UserHasAccess privilege={privilege}>{menu}</UserHasAccess>;
  }

  return menu;
}

export const createBillableServicesLeftPanelMenu = (config: BillableServicesMenuConfig) => () => (
  <BrowserRouter>
    <BillableServicesMenuExtension config={config} />
  </BrowserRouter>
);
