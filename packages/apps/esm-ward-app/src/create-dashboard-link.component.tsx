import { ConfigurableLink } from '@openmrs/esm-framework';
import classNames from 'classnames';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, useLocation } from 'react-router-dom';

export interface DashboardLinkConfig {
  name: string;
  title: string;
}

// TODO: extract this out into the esm-framework and all 4 copies of this file in this repo?

function DashboardExtension({ dashboardLinkConfig }: { dashboardLinkConfig: DashboardLinkConfig }) {
  //
  const { t } = useTranslation();
  const { name, title } = dashboardLinkConfig;
  const location = useLocation();
  const spaBasePath = `${globalThis.spaBase}/home`;

  const navLink = useMemo(() => {
    const pathArray = location.pathname.split('/home');
    const lastElement = pathArray[pathArray.length - 1];
    return decodeURIComponent(lastElement);
  }, [location.pathname]);

  return (
    <ConfigurableLink
      className={classNames('cds--side-nav__link', {
        'active-left-nav-link': navLink.match(name),
      })}
      to={`${spaBasePath}/${name}`}
    >
      {t(title)}
    </ConfigurableLink>
  );
}

export const createDashboardLink = (dashboardLinkConfig: DashboardLinkConfig) => () => (
  <BrowserRouter>
    <DashboardExtension dashboardLinkConfig={dashboardLinkConfig} />
  </BrowserRouter>
);
