import { ReportData } from '@carbon/react/icons';
import { ConfigurableLink } from '@openmrs/esm-framework';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';

import { moduleName } from '../constants';

export default function AdmissionDashboardLink() {
  const { t } = useTranslation(moduleName);
  const dashboardPath = '/admission';
  const href = `${globalThis.getOpenmrsSpaBase().slice(0, -1)}${dashboardPath}`;

  const isActive = globalThis.location.pathname.includes(dashboardPath);

  return (
    <ConfigurableLink
      aria-label={`${t('admission', 'Admisión')} ${t('admissionReportByUps', 'Reporte de admisiones por UPS')}`}
      className={classNames('cds--side-nav__link', { 'active-left-nav-link': isActive })}
      to={href}
    >
      <span className="sihsalus-side-nav__item">
        <ReportData aria-hidden="true" className="sihsalus-side-nav__icon" size={20} />
        <span className="sihsalus-side-nav__text">{t('admissionReportByUps', 'Reporte de admisiones por UPS')}</span>
      </span>
    </ConfigurableLink>
  );
}
