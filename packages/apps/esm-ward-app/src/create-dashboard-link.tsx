import { HospitalBed } from '@carbon/react/icons';
import { ConfigurableLink, type DashboardExtensionProps, type IconId } from '@openmrs/esm-framework';
import classNames from 'classnames';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, useLocation } from 'react-router-dom';

function WardDashboardLink({ config }: { config: Omit<DashboardExtensionProps, 'icon'> & { icon?: IconId } }) {
  const { t } = useTranslation();
  const location = useLocation();

  const isActive = useMemo(() => {
    const pathSegments = (location.pathname ?? '').split('/').map((segment) => decodeURIComponent(segment));
    return pathSegments.includes(config.path);
  }, [config.path, location.pathname]);

  return (
    <ConfigurableLink
      className={classNames('cds--side-nav__link', { 'active-left-nav-link': isActive })}
      to={`${config.basePath}/${encodeURIComponent(config.path)}`}
    >
      <span className="sihsalus-side-nav__item">
        <HospitalBed aria-hidden="true" className="sihsalus-side-nav__icon" size={20} />
        <span className="sihsalus-side-nav__text">{t(config.title)}</span>
      </span>
    </ConfigurableLink>
  );
}

export const createDashboardLink = (config: Omit<DashboardExtensionProps, 'icon'> & { icon?: IconId }) => () => (
  <BrowserRouter>
    <WardDashboardLink config={config} />
  </BrowserRouter>
);
