import { Home } from '@carbon/react/icons';
import { ConfigurableLink } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, useLocation } from 'react-router-dom';

export interface DashboardLinkConfig {
  name: string;
  title: string;
}

const DashboardLink = ({ dashboardLinkConfig }: { dashboardLinkConfig: DashboardLinkConfig }) => {
  const { t } = useTranslation();
  const { name } = dashboardLinkConfig;
  const location = useLocation();
  const spaBasePath = `${window.spaBase}/home`;

  const navLink = useMemo(() => {
    const pathArray = location.pathname.split('/');
    const lastElement = pathArray[pathArray.length - 1];
    return decodeURIComponent(lastElement);
  }, [location.pathname]);

  return (
    <ConfigurableLink
      to={spaBasePath}
      className={`cds--side-nav__link ${navLink === 'home' && 'active-left-nav-link'}`}
    >
      {/* t('home', 'Home') */}
      <span className="sihsalus-side-nav__item">
        <Home aria-hidden="true" className="sihsalus-side-nav__icon" size={20} />
        <span className="sihsalus-side-nav__text">{t(name)}</span>
      </span>
    </ConfigurableLink>
  );
};

export const createDashboardLink = (dashboardLinkConfig: DashboardLinkConfig) => {
  return () => (
    <BrowserRouter>
      <DashboardLink dashboardLinkConfig={dashboardLinkConfig} />
    </BrowserRouter>
  );
};
