import { Microscope } from '@carbon/react/icons';
import { ConfigurableLink } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, useLocation } from 'react-router-dom';

export interface DashboardLinkConfig {
  name: string;
  title: string;
}

function DashboardExtension({ dashboardLinkConfig }: { dashboardLinkConfig: DashboardLinkConfig }) {
  const { t } = useTranslation();
  const { name, title } = dashboardLinkConfig;
  const location = useLocation();
  const spaBasePath = `${globalThis.spaBase}/home`;

  const isActive = useMemo(() => {
    const pathSegments = location.pathname.split('/').map((segment) => decodeURIComponent(segment));
    return pathSegments.includes(name);
  }, [location.pathname, name]);

  return (
    <ConfigurableLink
      to={`${spaBasePath}/${name}`}
      className={`cds--side-nav__link ${isActive ? 'active-left-nav-link' : ''}`}
    >
      <span className="sihsalus-side-nav__item">
        <Microscope aria-hidden="true" className="sihsalus-side-nav__icon" size={20} />
        <span className="sihsalus-side-nav__text">{t(title)}</span>
      </span>
    </ConfigurableLink>
  );
}

export const createHomeDashboardLink = (dashboardLinkConfig: DashboardLinkConfig) => () => (
  <BrowserRouter>
    <DashboardExtension dashboardLinkConfig={dashboardLinkConfig} />
  </BrowserRouter>
);
