import { Button, ContentSwitcher, DataTableSkeleton, IconSwitch, InlineLoading } from '@carbon/react';
import { Add, Analytics, Table } from '@carbon/react/icons';
import { launchWorkspace, useLayoutType } from '@openmrs/esm-framework';
import {
  CardHeader,
  EmptyState,
  ErrorState,
  launchStartVisitPrompt,
  useVisitOrOfflineVisit,
} from '@openmrs/esm-patient-common-lib';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import ClinicalDataChart from './clinical-data-chart.component';
import styles from './clinical-data-overview.scss';
import PaginatedClinicalData from './paginated-clinical-data.component';

// Interfaz para los datos clínicos
interface ClinicalData {
  date: string;
  [key: string]: string | number | null; // Permite propiedades dinámicas
}

interface ClinicalTableRow {
  id: string;
  [key: string]: string | number | React.ReactNode;
}

interface ClinicalTableHeader {
  key: string;
  header: string;
  isSortable?: boolean;
  sortFunc?: (a: ClinicalTableRow, b: ClinicalTableRow) => number;
}

export interface ClinicalField {
  key: string;
  conceptUuid: string;
  label: string;
  isSortable?: boolean;
  sortFunc?: (a: ClinicalTableRow, b: ClinicalTableRow) => number;
  showInChart?: boolean;
  relatedField?: string; // Para campos relacionados como presión arterial (systolic/diastolic)
}
// Props del componente
interface ClinicalDataOverviewProps {
  patientUuid: string;
  pageSize?: number;
  headerTitle: string;
  data: Array<ClinicalData>;
  error: Error | null; // Puede ser null si no hay error
  isLoading: boolean;
  isValidating: boolean;
  tableHeaders: Array<ClinicalTableHeader>;
  tableRows: Array<ClinicalTableRow>;
  formWorkspace: string;
  emptyStateDisplayText: string;
  conceptUnits: Map<string, string>;
  config: Record<string, string>;
  chartConfig?: {
    vitalSigns: Array<{
      id: string;
      title: string;
      value: string;
    }>;
    mappings: { [key: string]: string };
  };
}

const ClinicalDataOverview: React.FC<ClinicalDataOverviewProps> = ({
  patientUuid,
  pageSize = 10,
  headerTitle,
  data,
  error,
  isLoading,
  isValidating,
  tableHeaders,
  tableRows,
  formWorkspace,
  emptyStateDisplayText,
  conceptUnits,
  config: _config,
  chartConfig,
}) => {
  const { t } = useTranslation();
  const [chartView, setChartView] = useState(false);
  const isTablet = useLayoutType() === 'tablet';
  const { currentVisit } = useVisitOrOfflineVisit(patientUuid);

  const launchForm = useCallback(() => {
    if (!currentVisit) {
      launchStartVisitPrompt();
      return;
    }
    launchWorkspace<{ patientUuid: string }>(formWorkspace, { patientUuid });
  }, [currentVisit, patientUuid, formWorkspace]);

  return (
    <>
      {((): React.ReactNode => {
        if (isLoading) return <DataTableSkeleton role="progressbar" zebra />;
        if (error) return <ErrorState error={error} headerTitle={headerTitle} />;
        if (data?.length) {
          return (
            <div className={styles.widgetCard}>
              <CardHeader title={headerTitle}>
                <div className={styles.backgroundDataFetchingIndicator}>
                  <span>{isValidating ? <InlineLoading /> : null}</span>
                </div>
                <div className={styles.clinicalDataHeaderActionItems}>
                  <ContentSwitcher
                    onChange={(evt) => setChartView(evt.name === 'chartView')}
                    size={isTablet ? 'md' : 'sm'}
                    aria-label={t('viewSelector', 'Select view type')}
                  >
                    <IconSwitch name="tableView" text={t('tableView', 'Table view')}>
                      <Table size={16} />
                    </IconSwitch>
                    <IconSwitch name="chartView" text={t('chartView', 'Chart view')}>
                      <Analytics size={16} />
                    </IconSwitch>
                  </ContentSwitcher>
                  <span className={styles.divider}>|</span>
                  <Button kind="ghost" renderIcon={Add} iconDescription={t('addData', 'Add data')} onClick={launchForm}>
                    {t('add', 'Add')}
                  </Button>
                </div>
              </CardHeader>
              {chartView && chartConfig ? (
                <ClinicalDataChart
                  patientData={data}
                  conceptUnits={conceptUnits}
                  vitalSigns={chartConfig.vitalSigns}
                  mappings={chartConfig.mappings}
                />
              ) : (
                <PaginatedClinicalData tableRows={tableRows} pageSize={pageSize} tableHeaders={tableHeaders} />
              )}
            </div>
          );
        }
        return <EmptyState displayText={emptyStateDisplayText} headerTitle={headerTitle} launchForm={launchForm} />;
      })()}
    </>
  );
};

export default ClinicalDataOverview;
