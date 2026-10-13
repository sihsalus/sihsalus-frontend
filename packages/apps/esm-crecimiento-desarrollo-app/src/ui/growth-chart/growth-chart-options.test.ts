import { ScaleTypes } from '@carbon/charts';
import { createInstance } from 'i18next';
import en from '../../../translations/en.json';
import es from '../../../translations/es.json';

import { buildGrowthChartOptions } from './growth-chart-options';

const i18n = createInstance();
beforeAll(async () => {
  await i18n.init({ lng: 'en', resources: { en: { translation: en }, es: { translation: es } } });
});

describe('growth-chart-options', () => {
  it('disables the Carbon zoom bar for numeric growth-chart domains', () => {
    const options = buildGrowthChartOptions({
      t: i18n.getFixedT('en'),
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
      t: i18n.getFixedT('en'),
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

it.each(['es', 'en'])('translates export controls, overflow and fullscreen in %s', (language) => {
  const options = buildGrowthChartOptions({
    t: i18n.getFixedT(language),
    locale: language,
    chartTitle: 'Synthetic growth chart',
    colorScale: {},
    translatedXAxisLabel: 'Months',
    translatedYAxisLabel: 'Weight',
    tooltipHtml: () => '',
    yDomain: [0, 20],
  });
  const messages = language === 'es' ? es : en;
  expect(options.locale?.code).toBe(language);
  expect(options.locale?.translations?.toolbar).toEqual({
    exportAsCSV: messages.chartExportCSV,
    exportAsPNG: messages.chartExportPNG,
    zoomIn: messages.chartZoomIn,
    zoomOut: messages.chartZoomOut,
    resetZoom: messages.chartResetZoom,
    moreOptions: messages.chartMoreOptions,
    makeFullScreen: messages.chartFullscreen,
    exitFullScreen: messages.chartExitFullscreen,
  });
  expect(options.toolbar?.controls?.map(({ type }) => type)).toEqual([
    'Zoom in',
    'Zoom out',
    'Reset zoom',
    'Export as CSV',
    'Export as PNG',
    'Make fullscreen',
  ]);
});
