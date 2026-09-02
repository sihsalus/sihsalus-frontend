import routes from './routes.json';

describe('patient tests route contract', () => {
  it('reuses the recent results card in Consulta Externa behind the results privilege', () => {
    expect(routes.extensions).toContainEqual(
      expect.objectContaining({
        name: 'consulta-externa-lab-results-widget',
        slot: 'consulta-externa-pruebas-complementarias-slot',
        component: 'externalOverview',
        privileges: 'app:hoja.clinica.resultados',
      }),
    );
  });
});
