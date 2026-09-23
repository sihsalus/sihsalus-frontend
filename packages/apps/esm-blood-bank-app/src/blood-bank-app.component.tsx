import { BrowserRouter, MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';

import type { BloodBankApi } from './api';
import { bloodBankPrivileges, type BloodBankPrivilege } from './access/blood-bank-privileges';
import { ProtectedSection } from './access/protected-section.component';
import { BloodBankLayout } from './layout/blood-bank-layout.component';
import { ApplicantSelectionPage } from './sections/applicant-selection/applicant-selection-page.component';
import { CollectionPage } from './sections/collection/collection-page.component';
import { DashboardPage } from './sections/dashboard/dashboard-page.component';
import { DonorsPage } from './sections/donors/donors-page.component';
import { DonorFollowUpPage } from './sections/follow-up/donor-follow-up-page.component';
import { RecipientFollowUpPage } from './sections/follow-up/recipient-follow-up-page.component';
import { InventoryPage } from './sections/inventory/inventory-page.component';
import { CompatibilityPage } from './sections/laboratory/compatibility/compatibility-page.component';
import { FractionationPage } from './sections/laboratory/fractionation/fractionation-page.component';
import { ScreeningPage } from './sections/laboratory/screening/screening-page.component';
import { TransfersPage } from './sections/transfers/transfers-page.component';
import { TransfusionsPage } from './sections/transfusions/transfusions-page.component';

interface BloodBankAppProps {
  api: BloodBankApi;
  router?: 'browser' | 'memory';
  initialPath?: string;
  basename?: string;
}

function BloodBankRoutes({ api }: { api: BloodBankApi }) {
  const protectedPage = (privilege: BloodBankPrivilege, page: React.ReactNode) => (
    <ProtectedSection privilege={privilege}>{page}</ProtectedSection>
  );

  return (
    <Routes>
      <Route element={<BloodBankLayout />}>
        <Route index element={<DashboardPage api={api} />} />
        <Route path="donors" element={protectedPage(bloodBankPrivileges.donors, <DonorsPage api={api} />)} />
        <Route path="applicant-selection" element={protectedPage(bloodBankPrivileges.applicantSelection, <ApplicantSelectionPage />)} />
        <Route path="collection" element={protectedPage(bloodBankPrivileges.collection, <CollectionPage />)} />
        <Route path="laboratory" element={<Navigate replace to="screening" />} />
        <Route path="laboratory/screening" element={protectedPage(bloodBankPrivileges.screening, <ScreeningPage />)} />
        <Route path="laboratory/follow-up" element={<Navigate replace to="/follow-up/donor" />} />
        <Route path="laboratory/compatibility" element={protectedPage(bloodBankPrivileges.compatibility, <CompatibilityPage />)} />
        <Route path="laboratory/fractionation" element={protectedPage(bloodBankPrivileges.fractionation, <FractionationPage />)} />
        <Route path="follow-up" element={<Navigate replace to="donor" />} />
        <Route path="follow-up/donor" element={protectedPage(bloodBankPrivileges.donorFollowUp, <DonorFollowUpPage />)} />
        <Route path="follow-up/recipient" element={protectedPage(bloodBankPrivileges.recipientFollowUp, <RecipientFollowUpPage />)} />
        <Route path="transfers" element={protectedPage(bloodBankPrivileges.transfers, <TransfersPage />)} />
        <Route path="inventory" element={protectedPage(bloodBankPrivileges.inventory, <InventoryPage api={api} />)} />
        <Route path="transfusions" element={protectedPage(bloodBankPrivileges.transfusions, <TransfusionsPage />)} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Route>
    </Routes>
  );
}

export function BloodBankApp({ api, router = 'memory', initialPath = '/', basename }: BloodBankAppProps) {
  if (router === 'browser') {
    return <BrowserRouter basename={basename}><BloodBankRoutes api={api} /></BrowserRouter>;
  }

  return <MemoryRouter initialEntries={[initialPath]}><BloodBankRoutes api={api} /></MemoryRouter>;
}
