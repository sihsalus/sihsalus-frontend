/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment */
import { LineChart } from '@carbon/charts-react';
import { Button, InlineLoading, SkeletonText } from '@carbon/react';
import { ArrowLeftIcon, ConfigurableLink, formatDate } from '@openmrs/esm-framework';
import { EmptyState, type OBSERVATION_INTERPRETATION } from '@openmrs/esm-patient-common-lib';
import React, { type ComponentProps, useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { testResultsBasePath } from '../helpers';
import CommonDataTable from '../overview/common-datatable.component';
import usePanelData from '../panel-view/usePanelData';

import RangeSelector from './range-selector.component';
import styles from './trendline.scss';
import { useObstreeData } from './trendline-resource';

enum ScaleTypes {
  TIME = 'time',
  LINEAR = 'linear',
  LOG = 'log',
  LABELS = 'labels',
}

enum TickRotations {
  ALWAYS = 'always',
  AUTO = 'auto',
  NEVER = 'never',
}

interface TrendlineProps {
  patientUuid: string;
  conceptUuid?: string;
  conceptUuids?: string[];
  basePath: string;
  hideTrendlineHeader?: boolean;
  showBackToTimelineButton?: boolean;
}

const TrendLineBackground = ({ ...props }) => <div {...props} className={styles.background} />;

const TrendlineHeader = ({ patientUuid, title, referenceRange, isValidating, showBackToTimelineButton }) => {
  const { t } = useTranslation();
  return (
    <div className={styles.header}>
      <div className={styles.backButton}>
        {showBackToTimelineButton && (
          <ConfigurableLink to={testResultsBasePath(`/patient/${patientUuid}/chart`)}>
            <Button
              kind="ghost"
              renderIcon={(props: ComponentProps<typeof ArrowLeftIcon>) => <ArrowLeftIcon size={24} {...props} />}
              iconDescription={t('returnToTimeline', 'Return to timeline')}
            >
              <span>{t('backToTimeline', 'Back to timeline')}</span>
            </Button>
          </ConfigurableLink>
        )}
      </div>
      <div className={styles.content}>
        <span className={styles.title}>{title}</span>
        <span className={styles['reference-range']}>{referenceRange}</span>
      </div>
      <div>{isValidating && <InlineLoading className={styles.inlineLoader} />}</div>
    </div>
  );
};

const Trendline: React.FC<TrendlineProps> = ({
  patientUuid,
  conceptUuid,
  conceptUuids,
  hideTrendlineHeader = false,
  showBackToTimelineButton = false,
}) => {
  const { t } = useTranslation();
  const { groupedObservations, isLoading: panelDataIsLoading } = usePanelData();
  const {
    trendlineData,
    isLoading: obstreeIsLoading,
    isValidating: obstreeIsValidating,
  } = useObstreeData(patientUuid, conceptUuid || '');

  const [range, setRange] = useState<[Date, Date]>();
  const [showResultsTable, setShowResultsTable] = useState(false);

  const targetUuids = useMemo(() => {
    return conceptUuids || (conceptUuid ? [conceptUuid] : []);
  }, [conceptUuids, conceptUuid]);

  const hasObservationsInPanelData = useMemo(() => {
    return targetUuids.some((uuid) => groupedObservations[uuid]?.length > 0);
  }, [targetUuids, groupedObservations]);

  const isLoading = hasObservationsInPanelData ? panelDataIsLoading : obstreeIsLoading;
  const isValidating = hasObservationsInPanelData ? false : obstreeIsValidating;

  const { chartData, tableData, leftAxisTitle, chartTitleText, referenceRange } = useMemo(() => {
    const cData: Array<{
      date: Date;
      value: number;
      group: string;
      min?: number;
      max?: number;
    }> = [];

    const tData: Array<{
      id: string;
      dateTime: string;
      testName: string;
      value:
        | number
        | {
            value: number;
            interpretation: OBSERVATION_INTERPRETATION;
          };
    }> = [];

    let units = '';
    let title = '';
    let refRange = '';

    if (hasObservationsInPanelData) {
      targetUuids.forEach((uuid) => {
        const obsList = groupedObservations[uuid] || [];
        if (obsList.length > 0) {
          const firstObs = obsList[0];
          const hiNormal = firstObs.meta?.hiNormal;
          const lowNormal = firstObs.meta?.lowNormal;
          if (!units && firstObs.meta?.units) {
            units = firstObs.meta.units;
          }
          if (!title) {
            title = firstObs.name;
          }
          if (!refRange && firstObs.meta?.range) {
            refRange = firstObs.meta.range;
          }

          obsList.forEach((obs, idx) => {
            const dateObj = obs.issued ? new Date(obs.issued) : new Date(obs.effectiveDateTime);
            const val = parseFloat(obs.value);
            if (!Number.isNaN(val)) {
              const rangeBounds =
                hiNormal !== undefined && lowNormal !== undefined
                  ? {
                      max: parseFloat(hiNormal as any),
                      min: parseFloat(lowNormal as any),
                    }
                  : {};

              cData.push({
                date: dateObj,
                value: val,
                group: obs.name || title,
                ...rangeBounds,
              });

              const formattedDate = formatDate(dateObj, { mode: 'wide', time: true }) || dateObj.toLocaleString();

              tData.push({
                id: `${uuid}-${idx}`,
                dateTime: formattedDate,
                testName: obs.name || title,
                value: {
                  value: val,
                  interpretation: obs.interpretation,
                },
              });
            }
          });
        }
      });

      if (targetUuids.length > 1) {
        title = t('multipleTests', 'Multiple tests');
        refRange = ''; // Multiple reference ranges, so leave header range empty
      }
    } else {
      const fallbackObs = trendlineData?.obs || [];
      fallbackObs.forEach((obs, idx) => {
        const rangeBounds =
          trendlineData.hiNormal !== undefined && trendlineData.lowNormal !== undefined
            ? {
                max: trendlineData.hiNormal,
                min: trendlineData.lowNormal,
              }
            : {};

        cData.push({
          date: new Date(Date.parse(obs.obsDatetime)),
          value: parseFloat(obs.value),
          group: trendlineData.display,
          ...rangeBounds,
        });

        const dateObj = new Date(Date.parse(obs.obsDatetime));
        const formattedDate = formatDate(dateObj, { mode: 'wide', time: true }) || dateObj.toLocaleString();

        tData.push({
          id: `${idx}`,
          dateTime: formattedDate,
          testName: trendlineData.display,
          value: {
            value: parseFloat(obs.value),
            interpretation: obs.interpretation,
          },
        });
      });
      units = trendlineData.units || '';
      title = trendlineData.display || '';
      refRange = trendlineData.range || '';
    }

    return {
      chartData: cData,
      tableData: tData,
      leftAxisTitle: units,
      chartTitleText: title,
      referenceRange: refRange,
    };
  }, [hasObservationsInPanelData, targetUuids, groupedObservations, trendlineData, t]);

  const [upperRange, lowerRange] = useMemo(() => {
    if (chartData.length === 0) {
      return [new Date(), new Date()];
    }
    const sorted = [...chartData].sort((a, b) => a.date.getTime() - b.date.getTime());
    return [sorted[sorted.length - 1].date, sorted[0].date];
  }, [chartData]);

  const setLowerRange = useCallback(
    (selectedLowerRange: Date) => {
      setRange([selectedLowerRange > lowerRange ? selectedLowerRange : lowerRange, upperRange]);
    },
    [upperRange, lowerRange],
  );

  /**
   * reorder svg element to bring line in front of the area
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: chartData changes cause Carbon Charts to regenerate the SVG nodes this effect reorders.
  useLayoutEffect(() => {
    const graph = document.querySelector('g.cds--cc--area')?.parentElement;
    if (graph && graph.children && graph.children.length > 3) {
      graph.insertBefore(graph.children[3], graph.childNodes[2]);
    }
  }, [chartData]);

  const chartOptions = useMemo(
    () => ({
      bounds: {
        lowerBoundMapsTo: 'min',
        upperBoundMapsTo: 'max',
      },
      axes: {
        bottom: {
          title: t('date', 'Date'),
          mapsTo: 'date',
          scaleType: ScaleTypes.TIME,
          ticks: {
            rotation: TickRotations.ALWAYS,
          },
          domain: range,
        },
        left: {
          mapsTo: 'value',
          title: leftAxisTitle,
          scaleType: ScaleTypes.LINEAR,
          includeZero: false,
        },
      },
      height: '20.125rem',
      color: {
        scale:
          targetUuids.length === 1
            ? {
                [chartTitleText]: '#6929c4',
              }
            : undefined,
      },
      points: {
        radius: 4,
        enabled: true,
      },
      legend: {
        enabled: targetUuids.length > 1,
      },
      tooltip: {
        customHTML: (tooltipData) => {
          if (!tooltipData || tooltipData.length === 0) return '';
          const { group, value, date } = tooltipData[0];
          const formattedDate =
            formatDate(new Date(date), { mode: 'wide', time: true }) || new Date(date).toLocaleString();
          return `<div class="cds--tooltip cds--tooltip--shown" style="min-width: max-content; font-weight:600">
            <strong>${group}</strong><br/>
            ${value} ${leftAxisTitle}<br/>
            <span style="color: #c6c6c6; font-size: 0.75rem; font-weight:400">${formattedDate}</span>
          </div>`;
        },
      },
    }),
    [leftAxisTitle, range, chartTitleText, targetUuids, t],
  );

  const tableHeaderData = useMemo(() => {
    const headers = [
      {
        header: t('dateTime', 'Date and time'),
        key: 'dateTime',
      },
    ];
    if (targetUuids.length > 1) {
      headers.push({
        header: t('testName', 'Test name'),
        key: 'testName',
      });
    }
    headers.push({
      header: `${t('value', 'Value')} (${leftAxisTitle || ''})`,
      key: 'value',
    });
    return headers;
  }, [leftAxisTitle, t, targetUuids]);

  if (isLoading) {
    return <SkeletonText />;
  }

  if (chartData.length === 0) {
    return <EmptyState displayText={t('observationsDisplayText', 'observations')} headerTitle={chartTitleText} />;
  }

  return (
    <div className={styles.container}>
      {!hideTrendlineHeader && (
        <TrendlineHeader
          showBackToTimelineButton={showBackToTimelineButton}
          isValidating={isValidating}
          patientUuid={patientUuid}
          title={chartTitleText}
          referenceRange={referenceRange}
        />
      )}
      <TrendLineBackground>
        <RangeSelector setLowerRange={setLowerRange} upperRange={upperRange} />
        <LineChart data={chartData} options={chartOptions} />
      </TrendLineBackground>

      {showResultsTable ? (
        <>
          <Button className={styles['show-hide-table']} kind="ghost" onClick={() => setShowResultsTable(false)}>
            {t('hideResultsTable', 'Hide results table')}
          </Button>
          <DrawTable {...{ tableData, tableHeaderData }} />
        </>
      ) : (
        <Button className={styles['show-hide-table']} kind="ghost" onClick={() => setShowResultsTable(true)}>
          {t('showResultsTable', 'Show results table')}
        </Button>
      )}
    </div>
  );
};

const DrawTable = React.memo<{ tableData; tableHeaderData }>(({ tableData, tableHeaderData }) => {
  return <CommonDataTable data={tableData} tableHeaders={tableHeaderData} />;
});

export default Trendline;
