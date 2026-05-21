import { ConfigurableLink } from '@openmrs/esm-framework';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { routes } from '../constants';

interface OfflineToolsNavLinkProps {
  icon: React.ComponentType<any>;
  page?: string;
  title: string;
}

export default function OfflineToolsNavLink({ icon: Icon, page, title }: OfflineToolsNavLinkProps) {
  const { t } = useTranslation();
  const path = `${routes.offlineTools}${page ? `/${page}` : ''}`;
  const isActive = window.location.pathname.endsWith(path);

  return (
    <div key={page}>
      <ConfigurableLink
        to={'${openmrsSpaBase}/' + path}
        className={classNames('cds--side-nav__link', { 'active-left-nav-link': isActive })}
      >
        <span className="sihsalus-side-nav__item">
          <Icon aria-hidden="true" className="sihsalus-side-nav__icon" size={20} />
          <span className="sihsalus-side-nav__text">{t(title)}</span>
        </span>
      </ConfigurableLink>
    </div>
  );
}
