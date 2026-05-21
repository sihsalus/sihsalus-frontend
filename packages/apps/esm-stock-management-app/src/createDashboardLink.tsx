import { InventoryManagement } from '@carbon/react/icons';
import { ConfigurableLink } from '@openmrs/esm-framework';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, useLocation } from 'react-router-dom';

export interface DashboardLinkConfig {
  icon?: React.ComponentType<any>;
  name: string;
  title: string;
}

const translationKeys: Record<string, string> = {
  Overview: 'overview',
  Operations: 'stockOperations',
  Items: 'stockItems',
  'User role scopes': 'userRoleScopes',
  Sources: 'sources',
  Locations: 'locations',
  Reports: 'report',
  Settings: 'adminSettings',
};

function DashboardExtension({ dashboardLinkConfig }: { dashboardLinkConfig: DashboardLinkConfig }) {
  const { icon: Icon = InventoryManagement, name, title } = dashboardLinkConfig;
  const { t } = useTranslation();
  const location = useLocation();
  const spaBasePath = `${window.spaBase}/stock-management`;

  const navLink = useMemo(() => {
    const pathArray = location.pathname.split('/');
    const lastElement = pathArray[pathArray.length - 1];
    return decodeURIComponent(lastElement);
  }, [location.pathname]);

  const translatedTitle = translationKeys[title] ? t(translationKeys[title], title) : title;

  return (
    <ConfigurableLink
      to={`${spaBasePath}/${name}`}
      className={`cds--side-nav__link ${navLink.match(name) && 'active-left-nav-link'}`}
    >
      <span className="sihsalus-side-nav__item">
        <Icon aria-hidden="true" className="sihsalus-side-nav__icon" size={20} />
        <span className="sihsalus-side-nav__text">{translatedTitle}</span>
      </span>
    </ConfigurableLink>
  );
}

export const createDashboardLink = (dashboardLinkConfig: DashboardLinkConfig) => () => (
  <BrowserRouter>
    <DashboardExtension dashboardLinkConfig={dashboardLinkConfig} />
  </BrowserRouter>
);
