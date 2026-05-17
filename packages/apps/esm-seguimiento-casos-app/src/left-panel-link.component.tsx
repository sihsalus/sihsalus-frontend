import { UserFollow } from '@carbon/react/icons';
import { ConfigurableLink } from '@openmrs/esm-framework';
import last from 'lodash-es/last';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, useLocation } from 'react-router-dom';

export interface LinkConfig {
  name: string;
  title: string;
}

export function LinkExtension({ config }: { config: LinkConfig }): JSX.Element {
  const { t } = useTranslation();
  const { name, title } = config;
  const location = useLocation();
  const spaBasePath = globalThis.getOpenmrsSpaBase() + 'home';

  let urlSegment = useMemo(() => decodeURIComponent(last(location.pathname.split('/'))), [location.pathname]);

  const isUUID = (value) => {
    const regex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/;
    return regex.test(value);
  };

  if (isUUID(urlSegment)) {
    urlSegment = location.pathname.split('/').at(-2);
  }

  return (
    <ConfigurableLink
      to={spaBasePath + '/' + name}
      className={`cds--side-nav__link ${name === urlSegment && 'active-left-nav-link'}`}
    >
      <span className="sihsalus-side-nav__item">
        <UserFollow aria-hidden="true" className="sihsalus-side-nav__icon" size={20} />
        <span className="sihsalus-side-nav__text">{t(title, title)}</span>
      </span>
    </ConfigurableLink>
  );
}

export const createLeftPanelLink =
  (config: LinkConfig): (() => JSX.Element) =>
  () => (
    <BrowserRouter>
      <LinkExtension config={config} />
    </BrowserRouter>
  );
