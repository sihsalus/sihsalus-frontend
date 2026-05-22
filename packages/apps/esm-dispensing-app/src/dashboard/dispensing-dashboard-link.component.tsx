import { Pills } from '@carbon/react/icons';
import { ConfigurableLink } from '@openmrs/esm-framework';
import classNames from 'classnames';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, useLocation } from 'react-router-dom';

const DispensingDashboardLink = () => {
  return (
    <BrowserRouter>
      <DashboardExtension />
    </BrowserRouter>
  );
};

export default DispensingDashboardLink;

function DashboardExtension() {
  const { t } = useTranslation();
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
        'active-left-nav-link': navLink.match('dispensing'),
      })}
      to={`${spaBasePath}/dispensing`}
    >
      <span className="sihsalus-side-nav__item">
        <Pills aria-hidden="true" className="sihsalus-side-nav__icon" size={20} />
        <span className="sihsalus-side-nav__text">{t('dispensing', 'Dispensing')}</span>
      </span>
    </ConfigurableLink>
  );
}
