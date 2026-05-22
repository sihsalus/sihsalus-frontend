import { ExtensionSlot } from '@openmrs/esm-framework';
import React from 'react';
import { StockManagementHeader } from '../stock-management-header/stock-management-header.component';

const DashboardView: React.FC<{ dashboardSlot: string; title: string }> = ({ dashboardSlot, title }) => {
  return (
    <>
      <StockManagementHeader />
      <ExtensionSlot name={dashboardSlot} state={{ dashboardTitle: title }} />
    </>
  );
};

export default DashboardView;
