import { isDesktop, useLayoutType, useLeftNav, WorkspaceContainer } from '@openmrs/esm-framework';
import { modulePrivileges, RequireModulePrivilege } from '@sihsalus/esm-rbac';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import BillingHeader from '../billing-header/billing-header.component';
import styles from './billable-services.scss';
import CashPointConfiguration from './cash-point/cash-point-configuration.component';
// import BillWaiver from './bill-waiver/bill-waiver.component';
import BillableServicesDashboard from './dashboard/dashboard.component';
import PaymentModesConfig from './payment-modes/payment-modes-config.component';

const BillableServicesContent: React.FC = () => {
  const { t } = useTranslation();
  const layout = useLayoutType();
  const basePath = `${globalThis.spaBase}/billable-services`;

  useLeftNav({ name: 'billable-services-left-panel-slot', basePath });

  return (
    <BrowserRouter basename={basePath}>
      <div className={styles.pageWrapper}>
        <main className={classNames(styles.pageContent, { [styles.hasLeftNav]: isDesktop(layout) })}>
          <BillingHeader title={t('billing', 'Billing')} />
          <Routes>
            <Route path="/" element={<BillableServicesDashboard />} />
            <Route path="/cash-point-config" element={<CashPointConfiguration />} />
            <Route path="/payment-modes-config" element={<PaymentModesConfig />} />
            {/* <Route path="/waive-bill" element={<BillWaiver />} /> */}
          </Routes>
        </main>
      </div>
      <WorkspaceContainer contextKey="billable-services" />
    </BrowserRouter>
  );
};

const BillableServiceHome: React.FC = () => (
  <RequireModulePrivilege privilege={modulePrivileges.billableServices}>
    <BillableServicesContent />
  </RequireModulePrivilege>
);

export default BillableServiceHome;
