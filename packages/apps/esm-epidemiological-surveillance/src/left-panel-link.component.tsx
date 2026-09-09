import { Activity } from '@carbon/react/icons';
import { ConfigurableLink } from '@openmrs/esm-framework';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { epidemiologicalSurveillanceReadPrivilege } from './constants';

export interface LinkConfig {
  name: string;
  title: string;
}

function getCurrentUrlSegment(pathname: string): string | undefined {
  return decodeURIComponent(pathname.split('/').filter(Boolean).at(-1) ?? '');
}

export function LinkExtension({ config }: { config: LinkConfig }): JSX.Element {
  const { t } = useTranslation();
  const location = useLocation();
  const { name, title } = config;
  const spaBasePath = `${globalThis.getOpenmrsSpaBase()}home`;
  const urlSegment = useMemo(() => getCurrentUrlSegment(location.pathname), [location.pathname]);

  return (
    <RequirePrivilege privilege={epidemiologicalSurveillanceReadPrivilege} hideUnauthorized>
      <ConfigurableLink
        to={`${spaBasePath}/${name}`}
        className={`cds--side-nav__link ${name === urlSegment ? 'active-left-nav-link' : ''}`}
      >
        <span className="sihsalus-side-nav__item">
          <Activity aria-hidden="true" className="sihsalus-side-nav__icon" size={20} />
          <span className="sihsalus-side-nav__text">{t(title, title)}</span>
        </span>
      </ConfigurableLink>
    </RequirePrivilege>
  );
}

export const createLeftPanelLink =
  (config: LinkConfig): (() => JSX.Element) =>
  () => (
    <BrowserRouter>
      <LinkExtension config={config} />
    </BrowserRouter>
  );
