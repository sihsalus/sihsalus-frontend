import { ConfigurableLink, UserHasAccess } from '@openmrs/esm-framework';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, useLocation } from 'react-router-dom';

export interface BillableServicesLinkConfig {
  name: string;
  title: string;
  path: string;
  icon?: React.ComponentType<any>;
  privilege?: string;
}

function BillableServicesLinkExtension({ config }: { config: BillableServicesLinkConfig }) {
  const { title, path, icon: Icon, privilege } = config;
  const { t } = useTranslation();
  const location = useLocation();
  const spaBasePath = `${globalThis.spaBase}/billable-services`;

  const isActive = useMemo(() => {
    const currentPath = location.pathname.replace(spaBasePath, '');
    if (path === '' || path === '/') {
      return currentPath === '' || currentPath === '/';
    }
    return currentPath.startsWith(`/${path}`);
  }, [location.pathname, path, spaBasePath]);

  const link = (
    <ConfigurableLink
      to={`${spaBasePath}/${path}`}
      className={`cds--side-nav__link ${isActive ? 'active-left-nav-link' : ''}`}
    >
      <span className="sihsalus-side-nav__item">
        {Icon ? <Icon aria-hidden="true" className="sihsalus-side-nav__icon" size={20} /> : null}
        <span className="sihsalus-side-nav__text">{t(title)}</span>
      </span>
    </ConfigurableLink>
  );

  if (privilege) {
    return <UserHasAccess privilege={privilege}>{link}</UserHasAccess>;
  }

  return link;
}

export const createBillableServicesLeftPanelLink = (config: BillableServicesLinkConfig) => () => (
  <BrowserRouter>
    <BillableServicesLinkExtension config={config} />
  </BrowserRouter>
);
