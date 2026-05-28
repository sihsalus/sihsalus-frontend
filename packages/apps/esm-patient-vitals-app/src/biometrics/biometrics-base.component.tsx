import { Button, ContentSwitcher, DataTableSkeleton, IconSwitch, InlineLoading } from '@carbon/react';
import { Add, Analytics, Table } from '@carbon/react/icons';
import { formatDatetime, parseDate, useConfig, useLayoutType } from '@openmrs/esm-framework';
import { CardHeader, EmptyState, ErrorState, useVisitOrOfflineVisit } from '@openmrs/esm-patient-common-lib';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { shouldShowBmi, useVitalsAndBiometrics, useVitalsConceptMetadata, withUnit } from '../common';
import { type ConfigObject } from '../config-schema';
import { launchVitalsAndBiometricsForm } from '../utils';

import styles from './biometrics-base.scss';
import BiometricsChart from './biometrics-chart.component';
import PaginatedBiometrics from './paginated-biometrics.component';
import type { BiometricsTableHeader, BiometricsTableRow } from './types';

interface BiometricsBaseProps {
  pageSize: number;
  pageUrl: string;
  patientUuid: string;
  urlLabel: string;
  patient?: fhir.Patient;
}

const BiometricsBase: React.FC<BiometricsBaseProps> = ({ patientUuid, pageSize, urlLabel, pageUrl, patient }) => {
  const { t } = useTranslation();
  const displayText = t('biometrics_lower', 'biometrics');
  const headerTitle = t('biometrics', 'Biometrics');
  const [chartView, setChartView] = useState(false);
  const isTablet = useLayoutType() === 'tablet';

  const config = useConfig<ConfigObject>();
  const { abdominalCircumferenceUnit, bmiUnit } = config.biometrics;
  const { data: biometrics, isLoading, error, isValidating } = useVitalsAndBiometrics(patientUuid, 'biometrics');
  const { data: conceptUnits, error: conceptsError } = useVitalsConceptMetadata();
  const { currentVisit } = useVisitOrOfflineVisit(patientUuid);

  const showBmi = shouldShowBmi(patient, config.biometrics);

  const launchBiometricsForm = useCallback(
    () => launchVitalsAndBiometricsForm(currentVisit, config),
    [config, currentVisit],
  );

  const tableHeaders: Array<BiometricsTableHeader> = [
    {
      key: 'dateRender',
      header: t('dateAndTime', 'Date and time'),
      isSortable: true,
      sortFunc: (valueA, valueB) => new Date(valueA.date).getTime() - new Date(valueB.date).getTime(),
    },
    {
      key: 'weightRender',
      header: withUnit(t('weight', 'Weight'), conceptUnits.get(config.concepts.weightUuid) ?? ''),
      isSortable: true,
      sortFunc: (valueA, valueB) => (valueA.weight && valueB.weight ? valueA.weight - valueB.weight : 0),
    },
    {
      key: 'heightRender',
      header: withUnit(t('height', 'Height'), conceptUnits.get(config.concepts.heightUuid) ?? ''),
      isSortable: true,
      sortFunc: (valueA, valueB) => (valueA.height && valueB.height ? valueA.height - valueB.height : 0),
    },
    ...(showBmi
      ? [
          {
            key: 'bmiRender' as const,
            header: `${t('bmi', 'BMI')} (${bmiUnit})`,
            isSortable: true,
            sortFunc: (valueA: BiometricsTableRow, valueB: BiometricsTableRow) =>
              valueA.bmi && valueB.bmi ? (valueA.bmi as number) - (valueB.bmi as number) : 0,
          },
        ]
      : []),
    {
      key: 'muacRender',
      header: withUnit(t('muac', 'MUAC'), conceptUnits.get(config.concepts.midUpperArmCircumferenceUuid) ?? ''),
      isSortable: true,
      sortFunc: (valueA, valueB) => (valueA.muac && valueB.muac ? valueA.muac - valueB.muac : 0),
    },
    {
      key: 'abdominalCircumferenceRender',
      header: withUnit(
        t('abdominalCircumference', 'Abdominal circumference'),
        conceptUnits.get(config.concepts.abdominalCircumferenceUuid) ?? abdominalCircumferenceUnit,
      ),
      isSortable: true,
      sortFunc: (valueA, valueB) =>
        valueA.abdominalCircumference && valueB.abdominalCircumference
          ? valueA.abdominalCircumference - valueB.abdominalCircumference
          : 0,
    },
  ];

  const tableRows: Array<BiometricsTableRow> = useMemo(
    () =>
      biometrics?.map((biometricsData, index) => {
        return {
          ...biometricsData,
          id: `${index}`,
          dateRender: formatDatetime(parseDate(biometricsData.date.toString()), { mode: 'wide' }),
          weightRender: biometricsData.weight ?? '--',
          heightRender: biometricsData.height ?? '--',
          bmiRender: biometricsData.bmi ?? '--',
          muacRender: biometricsData.muac ?? '--',
          abdominalCircumferenceRender: biometricsData.abdominalCircumference ?? '--',
        };
      }),
    [biometrics],
  );

  if (isLoading) return <DataTableSkeleton role="progressbar" />;
  if (error || conceptsError) return <ErrorState error={(error ?? conceptsError) as Error} headerTitle={headerTitle} />;
  if (biometrics?.length) {
    return (
      <div className={styles.widgetCard}>
        <CardHeader title={headerTitle}>
          <div className={styles.backgroundDataFetchingIndicator}>
            <span>{isValidating ? <InlineLoading /> : null}</span>
          </div>
          <div className={styles.biometricsHeaderActionItems}>
            <ContentSwitcher onChange={(evt) => setChartView(evt.name === 'chartView')} size={isTablet ? 'md' : 'sm'}>
              <IconSwitch name="tableView" text="Table view">
                <Table size={16} />
              </IconSwitch>
              <IconSwitch name="chartView" text="Chart view">
                <Analytics size={16} />
              </IconSwitch>
            </ContentSwitcher>
            <>
              <span className={styles.divider}>|</span>
              <Button
                kind="ghost"
                renderIcon={(props) => <Add size={16} {...props} />}
                iconDescription="Add biometrics"
                onClick={launchBiometricsForm}
              >
                {t('add', 'Add')}
              </Button>
            </>
          </div>
        </CardHeader>
        {chartView ? (
          <BiometricsChart patientBiometrics={biometrics} conceptUnits={conceptUnits} config={config} />
        ) : (
          <PaginatedBiometrics
            tableRows={tableRows}
            pageSize={pageSize}
            urlLabel={urlLabel}
            pageUrl={pageUrl}
            tableHeaders={tableHeaders}
          />
        )}
      </div>
    );
  }
  return <EmptyState displayText={displayText} headerTitle={headerTitle} launchForm={launchBiometricsForm} />;
};

export default BiometricsBase;
