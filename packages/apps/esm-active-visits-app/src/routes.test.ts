import routes from './routes.json';

const activeVisitsPrivilege = 'app:home.tabla.consultas.activas';
const chartPrivilege = 'app:hoja.clinica';

function extension(name: string) {
  return routes.extensions.find((candidate) => candidate.name === name);
}

describe('active visits route privilege contract', () => {
  it('protects the homepage active visits table with its dedicated privilege', () => {
    expect(extension('active-visits-widget')).toMatchObject({ privileges: activeVisitsPrivilege });
  });

  it('protects the patient visit summary with the chart privilege', () => {
    expect(extension('visit-summary-widget')).toMatchObject({ privileges: chartPrivilege });
  });

  it('keeps aggregate visit metrics available without chart access', () => {
    expect(extension('active-visits-tile')).not.toHaveProperty('privileges');
    expect(extension('total-visits-tile')).not.toHaveProperty('privileges');
  });
});
