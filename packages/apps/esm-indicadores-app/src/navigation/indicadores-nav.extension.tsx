import { SideNavLink } from '@carbon/react';
import { navigate } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, useLocation } from 'react-router-dom';

import { indicadoresNavigation } from './indicadores-navigation';

function getOpenmrsSpaBase(): string {
  const value = (globalThis as { getOpenmrsSpaBase?: () => unknown }).getOpenmrsSpaBase?.();
  return typeof value === 'string' ? value.replace(/\/+$/, '') : '/openmrs/spa';
}

function IndicadoresNavContent() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const modulePath = `${getOpenmrsSpaBase()}/indicators`;

  return (
    <>
      {indicadoresNavigation.map((item) => {
        const href = `${modulePath}${item.path === '/' ? '' : item.path}`;
        const isActive = pathname === href;

        return (
          <SideNavLink
            key={item.path}
            href={href}
            isActive={isActive}
            aria-current={isActive ? 'page' : undefined}
            renderIcon={item.icon}
            onClick={(event) => {
              event.preventDefault();
              navigate({ to: href });
            }}
          >
            {t(item.labelKey, item.defaultLabel)}
          </SideNavLink>
        );
      })}
    </>
  );
}

/**
 * Left navigation rendered by the shell rail for this module. It is registered
 * into the `indicadores-nav-slot` extension slot, which `root.component.tsx`
 * activates with `useLeftNav`. `BrowserRouter` is required because the shell
 * renders this extension outside the module's own router.
 */
const IndicadoresNav: React.FC = () => (
  <BrowserRouter>
    <IndicadoresNavContent />
  </BrowserRouter>
);

export default IndicadoresNav;
