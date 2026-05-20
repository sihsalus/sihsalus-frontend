import { Money } from '@carbon/react/icons';
import { ConfigurableLink } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, useLocation } from 'react-router-dom';

export interface LinkConfig {
  name: string;
  title: string;
}

export function LinkExtension({ config }: { config: LinkConfig }) {
  const { t } = useTranslation();
  const { name, title } = config;
  const location = useLocation();
  const spaBasePath = globalThis.getOpenmrsSpaBase() + 'home';

  const isActive = useMemo(() => {
    const pathSegments = location.pathname.split('/').map((s) => decodeURIComponent(s));
    return pathSegments.includes(name);
  }, [location.pathname, name]);

  return (
    <ConfigurableLink
      to={spaBasePath + '/' + name}
      className={`cds--side-nav__link ${isActive && 'active-left-nav-link'}`}
    >
      <span className="sihsalus-side-nav__item">
        <Money aria-hidden="true" className="sihsalus-side-nav__icon" size={20} />
        <span className="sihsalus-side-nav__text">{t(title)}</span>
      </span>
    </ConfigurableLink>
  );
}

export const createLeftPanelLink = (config: LinkConfig) => () => (
  <BrowserRouter>
    <LinkExtension config={config} />
  </BrowserRouter>
);
