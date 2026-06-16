import { type LineChartOptions, ScaleTypes } from '@carbon/charts';

import type { GrowthChartPoint } from './growth-chart-utils';

interface BuildGrowthChartOptionsParams {
  chartTitle: string;
  colorScale: Record<string, string>;
  translatedXAxisLabel: string;
  translatedYAxisLabel: string;
  tooltipHtml: (datum: GrowthChartPoint | undefined) => string;
  yDomain: [number, number];
}

export function buildGrowthChartOptions({
  chartTitle,
  colorScale,
  translatedXAxisLabel,
  translatedYAxisLabel,
  tooltipHtml,
  yDomain,
}: BuildGrowthChartOptionsParams): LineChartOptions {
  return {
    title: chartTitle,
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
