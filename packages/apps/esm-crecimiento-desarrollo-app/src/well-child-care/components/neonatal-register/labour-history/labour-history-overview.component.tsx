import { Button, ContentSwitcher, DataTableSkeleton, IconSwitch, InlineLoading } from '@carbon/react';
import { Add, Analytics, Table } from '@carbon/react/icons';
import { formatDate, parseDate, useLayoutType } from '@openmrs/esm-framework';
import { CardHeader, EmptyState, ErrorState } from '@openmrs/esm-patient-common-lib';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCREDFormLauncher } from '../../../../hooks/useCREDFormLauncher';
import { useCurrentPregnancy } from '../../../../hooks/useCurrentPregnancy';
import type { LabourHistoryTableRow } from '../../../common/types';

import LabourHistoryChart from './labour-history-chart.component';
import styles from './labour-history-overview.scss';

interface LabourHistoryOverviewProps {
  patientUuid: string;
  pageSize?: number;
}

const LabourHistoryOverview: React.FC<LabourHistoryOverviewProps> = ({ patientUuid, pageSize: _pageSize = 10 }) => {
  const { t } = useTranslation();
  const headerTitle = t('labourHistorySummary', 'Labour history summary');
  const [chartView, setChartView] = useState(false);
  const isTablet = useLayoutType() === 'tablet';

  const { prenatalEncounter: data, error, isLoading, mutate } = useCurrentPregnancy(patientUuid);
  const { launchForm: launchConfiguredLabourForm, isLoading: isFormLoading } =
    useCREDFormLauncher('deliveryOrAbortion');

  const launchLabourForm = useCallback(() => {
    launchConfiguredLabourForm('', () => void mutate());
  }, [launchConfiguredLabourForm, mutate]);

  const tableRows: LabourHistoryTableRow[] = useMemo(() => {
    if (!data?.obs) return [];

    const rows: LabourHistoryTableRow[] = [];
    let rowId = 0;

    data.obs.forEach((_obs) => {
      const row: LabourHistoryTableRow = {
        id: `row-${rowId++}`,
        date: formatDate(parseDate(data.encounterDatetime), { mode: 'wide', time: true }),
      };

      if (Object.keys(row).length > 2) rows.push(row); // Solo agregar si tiene datos relevantes
    });

    return rows;
  }, [data]);

  if (isLoading && !data) return <DataTableSkeleton />;
  if (error) return <ErrorState error={error} headerTitle={headerTitle} />;
  if (tableRows.length) {
    return (
      <div className={styles.widgetCard}>
        <CardHeader title={headerTitle}>
          <div className={styles.backgroundDataFetchingIndicator}>
            <span>{isLoading ? <InlineLoading /> : null}</span>
          </div>
          <div className={styles.headerActionItems}>
            <ContentSwitcher onChange={(evt) => setChartView(evt.name === 'chartView')} size={isTablet ? 'md' : 'sm'}>
              <IconSwitch name="tableView" text="Table View">
                <Table size={16} />
              </IconSwitch>
              <IconSwitch name="chartView" text="Chart View">
                <Analytics size={16} />
              </IconSwitch>
            </ContentSwitcher>
            <span className={styles.divider}>|</span>
            <Button
              kind="ghost"
              disabled={isFormLoading}
              renderIcon={(props) => <Add size={16} {...props} />}
              iconDescription="Add labour details"
              onClick={launchLabourForm}
            >
              {t('add', 'Add')}
            </Button>
          </div>
        </CardHeader>
        {chartView ? <LabourHistoryChart patientHistory={tableRows} /> : <></>}
      </div>
    );
  }
  return (
    <EmptyState
      displayText={t('labourHistorySummary', 'Labour history summary')}
      headerTitle={headerTitle}
      launchForm={launchLabourForm}
    />
  );
};

export default LabourHistoryOverview;
