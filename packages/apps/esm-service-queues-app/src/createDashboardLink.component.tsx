import { WatsonHealthStackedScrolling_1 } from '@carbon/react/icons';
import { ConfigurableLink } from '@openmrs/esm-framework';
import classNames from 'classnames';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, useLocation } from 'react-router-dom';

import { spaBasePath } from './constants';

export interface DashboardLinkConfig {
  name: string;
  title: string;
}

function DashboardExtension({ dashboardLinkConfig }: { dashboardLinkConfig: DashboardLinkConfig }) {
  const { t } = useTranslation();
  const { name, title } = dashboardLinkConfig;
  const location = useLocation();

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
      <span className="sihsalus-side-nav__item">
        <WatsonHealthStackedScrolling_1 aria-hidden="true" className="sihsalus-side-nav__icon" size={20} />
        <span className="sihsalus-side-nav__text">{t('serviceQueues', 'Service queues')}</span>
      </span>
    </ConfigurableLink>
  );
}

export const createDashboardLink = (dashboardLinkConfig: DashboardLinkConfig) => () => (
  <BrowserRouter>
    <DashboardExtension dashboardLinkConfig={dashboardLinkConfig} />
  </BrowserRouter>
);
