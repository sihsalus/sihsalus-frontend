import { type LineChartOptions, ScaleTypes } from '@carbon/charts';
import type { TFunction } from 'i18next';

import type { GrowthChartPoint } from './growth-chart-utils';

interface BuildGrowthChartOptionsParams {
  t: TFunction;
  locale?: string;
  chartTitle: string;
  colorScale: Record<string, string>;
  translatedXAxisLabel: string;
  translatedYAxisLabel: string;
  tooltipHtml: (datum: GrowthChartPoint | undefined) => string;
  yDomain: [number, number];
}

export function buildGrowthChartOptions({
  t,
  locale,
  chartTitle,
  colorScale,
  translatedXAxisLabel,
  translatedYAxisLabel,
  tooltipHtml,
  yDomain,
}: BuildGrowthChartOptionsParams): LineChartOptions {
  return {
    title: chartTitle,
    locale: {
      code: locale,
      translations: {
        toolbar: {
          exportAsCSV: t('chartExportCSV', 'Export as CSV'),
          exportAsPNG: t('chartExportPNG', 'Export as PNG'),
          zoomIn: t('chartZoomIn', 'Zoom in'),
          zoomOut: t('chartZoomOut', 'Zoom out'),
          resetZoom: t('chartResetZoom', 'Reset zoom'),
          moreOptions: t('chartMoreOptions', 'More options'),
          makeFullScreen: t('chartFullscreen', 'Make fullscreen'),
          exitFullScreen: t('chartExitFullscreen', 'Exit fullscreen'),
        },
      },
    },
    axes: {
      bottom: {
        title: translatedXAxisLabel,
        mapsTo: 'date',
        scaleType: ScaleTypes.LINEAR,
      },
      left: {
        title: translatedYAxisLabel,
        mapsTo: 'value',
        scaleType: ScaleTypes.LINEAR,
        domain: yDomain,
      },
    },
    legend: { enabled: true },
    tooltip: {
      customHTML: (tooltipData: GrowthChartPoint[]) => tooltipHtml(tooltipData[0]),
    },
    toolbar: {
      enabled: true,
      numberOfIcons: 4,
      controls: [
        { type: 'Zoom in' },
        { type: 'Zoom out' },
        { type: 'Reset zoom' },
        { type: 'Export as CSV' },
        { type: 'Export as PNG' },
        { type: 'Make fullscreen' },
      ],
    },
    // Carbon's zoomBar aggregates the domain with getTime(); this chart's domain is numeric age/length data.
    zoomBar: {
      top: {
        enabled: false,
      },
    },
    height: '400px',
    points: { enabled: true, radius: 2 },
    color: {
      scale: colorScale,
    },
  };
}
