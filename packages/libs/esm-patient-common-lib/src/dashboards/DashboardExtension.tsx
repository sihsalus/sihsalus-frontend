import { ConfigurableLink } from '@openmrs/esm-framework';
import { MaybeIcon } from '@openmrs/esm-styleguide';
import classNames from 'classnames';
import { last } from 'lodash-es';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import styles from './dashboard-extension.scss';

export interface DashboardExtensionProps {
  readonly path: string;
  readonly title: string;
  readonly basePath: string;
  readonly icon: string;
  readonly moduleName?: string;
  readonly tooltip?: string;
}

export const DashboardExtension = ({
  path,
  title,
  basePath,
  icon,
  moduleName = '@sihsalus/esm-patient-chart-app',
  tooltip,
}: DashboardExtensionProps) => {
  const { t } = useTranslation(moduleName);
  const location = useLocation();

  const navLink = useMemo(() => decodeURIComponent(last(location.pathname.split('/'))), [location.pathname]);
  const translatedTooltip = tooltip ? t(tooltip) : undefined;
  const link = (
    <ConfigurableLink
      className={classNames('cds--side-nav__link', { 'active-left-nav-link': path === navLink })}
      title={translatedTooltip}
      to={`${basePath}/${encodeURIComponent(path)}`}
    >
      <span className={styles.menu}>
        <MaybeIcon icon={icon} className={styles.icon} size={16} />
        <span>{t(title)}</span>
      </span>
    </ConfigurableLink>
  );

  return (
    <div key={path} className={styles.navItem}>
      {link}
    </div>
  );
};
