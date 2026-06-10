import { formatDate, parseDate, useConfig } from '@openmrs/esm-framework';
import { ClinicalDataOverview } from '@sihsalus/esm-sihsalus-shared';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { credNeonatalEditPrivilege } from '../../../../constants';
import { useHasPrivilege } from '../../../../rbac';
import { useBalance, useVitalsConceptMetadata, withUnit } from '../../../common';

interface BalanceOverviewProps {
  patientUuid: string;
  pageSize?: number;
}

const NewbornBalanceOverview: React.FC<BalanceOverviewProps> = ({ patientUuid, pageSize = 10 }) => {
  const { t } = useTranslation();
  const canEdit = useHasPrivilege(credNeonatalEditPrivilege);
  const config = useConfig();
  const { data: conceptUnits } = useVitalsConceptMetadata();
  const { data: balanceData, error, isLoading, isValidating } = useBalance(patientUuid);

  const clinicalFields = useMemo(
    () => [
      {
        key: 'date',
        label: t('date&Time', 'Date & time'),
        isSortable: true,
        sortFunc: (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        format: (date) => formatDate(parseDate(date), { mode: 'wide', time: true }),
        showInChart: false,
      },
      {
        key: 'stoolCount',
        conceptUuid: 'stoolCountUuid',
        label: 'stoolCount',
        isSortable: true,
        sortFunc: (a, b) => (a.stoolCount && b.stoolCount ? a.stoolCount - b.stoolCount : 0),
        showInChart: true,
      },
      {
        key: 'stoolGrams',
        conceptUuid: 'stoolGramsUuid',
        label: 'stoolGrams',
        isSortable: true,
        sortFunc: (a, b) => (a.stoolGrams && b.stoolGrams ? a.stoolGrams - b.stoolGrams : 0),
        showInChart: true,
      },
      {
        key: 'urineCount',
        conceptUuid: 'urineCountUuid',
        label: 'urineCount',
        isSortable: true,
        sortFunc: (a, b) => (a.urineCount && b.urineCount ? a.urineCount - b.urineCount : 0),
        showInChart: true,
      },
      {
        key: 'urineGrams',
        conceptUuid: 'urineGramsUuid',
        label: 'urineGrams',
        isSortable: true,
        sortFunc: (a, b) => (a.urineGrams && b.urineGrams ? a.urineGrams - b.urineGrams : 0),
        showInChart: true,
      },
      {
        key: 'vomitCount',
        conceptUuid: 'vomitCountUuid',
        label: 'vomitCount',
        isSortable: true,
        sortFunc: (a, b) => (a.vomitCount && b.vomitCount ? a.vomitCount - b.vomitCount : 0),
        showInChart: true,
      },
      {
        key: 'vomitGramsML',
        conceptUuid: 'vomitGramsMLUuid',
        label: 'vomitGramsML',
        isSortable: true,
        sortFunc: (a, b) => (a.vomitGramsML && b.vomitGramsML ? a.vomitGramsML - b.vomitGramsML : 0),
        showInChart: true,
      },
    ],
    [t],
  );

  const { tableHeaders, tableRows, chartConfig } = useMemo(() => {
    // Generar tableHeaders
    const headers = clinicalFields.map((field) => ({
      key: field.key,
      header: field.conceptUuid
        ? withUnit(t(field.label), conceptUnits.get(config.concepts[field.conceptUuid]) ?? '')
        : t(field.label),
      isSortable: field.isSortable,
      sortFunc: field.sortFunc,
    }));

    // Generar tableRows
    const rows =
      balanceData?.map((item, index) => {
        const row: { id: string; [key: string]: string | number | React.ReactNode } = { id: `${index}` };
        clinicalFields.forEach((field) => {
          row[field.key] = field.format ? field.format(item[field.key] || item.date) : (item[field.key] ?? '--');
        });
        return row;
      }) || [];

    // Generar chartConfig
    const vitalSigns = clinicalFields
      .filter((field) => field.showInChart && field.conceptUuid)
      .map((field) => ({
        id: field.key,
        title: withUnit(t(field.label), conceptUnits.get(config.concepts[field.conceptUuid]) ?? '-'),
        value: field.key,
      }));

    return {
      tableHeaders: headers,
      tableRows: rows,
      chartConfig: {
        vitalSigns,
        mappings: {},
      },
    };
  }, [clinicalFields, balanceData, conceptUnits, config.concepts, t]);

  const clinicalData = (balanceData ?? []) as unknown as Array<{ date: string; [key: string]: string | number | null }>;

  return (
    <ClinicalDataOverview
      patientUuid={patientUuid}
      pageSize={pageSize}
      headerTitle={t('balanceOverview', 'Balance de líquidos del recién nacido')}
      data={clinicalData}
      error={error}
      isLoading={isLoading}
      isValidating={isValidating}
      tableHeaders={tableHeaders}
      tableRows={tableRows}
      formWorkspace={canEdit ? 'newborn-fluidBalance-form' : undefined}
      emptyStateDisplayText={t('balanceOverview', 'Balance de líquidos del recién nacido')}
      conceptUnits={conceptUnits}
      config={config}
      chartConfig={chartConfig}
    />
  );
};

export default NewbornBalanceOverview;
