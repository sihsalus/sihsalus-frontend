import routes from './routes.json';

const chartPrivilege = 'app:hoja.clinica';

function extension(name: string) {
  return routes.extensions.find((candidate) => candidate.name === name);
}

describe('active visits route privilege contract', () => {
  it('protects patient-level active visit data with the chart privilege', () => {
    expect(extension('active-visits-widget')).toMatchObject({ privileges: chartPrivilege });
    expect(extension('visit-summary-widget')).toMatchObject({ privileges: chartPrivilege });
  });

  it('keeps aggregate visit metrics available without chart access', () => {
    expect(extension('active-visits-tile')).not.toHaveProperty('privileges');
    expect(extension('total-visits-tile')).not.toHaveProperty('privileges');
  });
});
