import { ScaleTypes } from '@carbon/charts';

import { buildGrowthChartOptions } from './growth-chart-options';

describe('growth-chart-options', () => {
  it('disables the Carbon zoom bar for numeric growth-chart domains', () => {
    const options = buildGrowthChartOptions({
      chartTitle: 'Weight for age',
      colorScale: { P50: '#198038', Patient: '#2b6693' },
      translatedXAxisLabel: 'Months',
      translatedYAxisLabel: 'Weight (kg)',
      tooltipHtml: () => '',
      yDomain: [0, 20],
    });

    expect(options.axes?.bottom?.mapsTo).toBe('date');
    expect(options.axes?.bottom?.scaleType).toBe(ScaleTypes.LINEAR);
    expect(options.zoomBar?.top?.enabled).toBe(false);
  });

  it('delegates tooltip HTML generation to the selected datum', () => {
    const options = buildGrowthChartOptions({
      chartTitle: 'Weight for age',
      colorScale: {},
      translatedXAxisLabel: 'Months',
      translatedYAxisLabel: 'Weight (kg)',
      tooltipHtml: (datum) => `tooltip:${datum?.group}`,
      yDomain: [0, 20],
    });

    const html = options.tooltip?.customHTML?.([{ group: 'Patient', date: 12, value: 9 }], '', undefined);

    expect(html).toBe('tooltip:Patient');
  });
});
