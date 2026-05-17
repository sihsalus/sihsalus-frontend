import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ClaimManagementHeader } from '../header/case-management-header';
import MetricsHeader from '../metrics/case-management-header.component';
import CaseManagementTabs from '../tabs/case-management-tabs.component';

const WrapComponent: React.FC = () => {
  const [activeTabIndex, setActiveTabIndex] = useState<number>(0);
  const { t } = useTranslation();

  return (
    <div className="omrs-main-content">
      <ClaimManagementHeader title={t('caseManagemet', 'Case Management')} />
      <MetricsHeader activeTabIndex={activeTabIndex} />
      <CaseManagementTabs setActiveTabIndex={setActiveTabIndex} />
    </div>
  );
};

export default WrapComponent;
