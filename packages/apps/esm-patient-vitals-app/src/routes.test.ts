import routes from './routes.json';

const fullWidthChartExtensions = [
  'vitals-overview-widget',
  'consulta-externa-vitals-overview-widget',
  'vitals-details-widget',
  'biometrics-overview-widget',
  'biometrics-details-widget',
];

describe('vitals and biometrics route layout contract', () => {
  it.each(fullWidthChartExtensions)('renders %s across the available dashboard width', (extensionName) => {
    expect(routes.extensions.find(({ name }) => name === extensionName)).toMatchObject({
      meta: expect.objectContaining({ fullWidth: true }),
    });
  });
});
