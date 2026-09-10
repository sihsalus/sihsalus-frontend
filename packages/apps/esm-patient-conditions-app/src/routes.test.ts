import routes from './routes.json';

describe('patient conditions route contract', () => {
  it('shares the existing antecedents view with Consulta Externa under the conditions read privilege', () => {
    const detailViews = routes.extensions.filter((extension) => extension.component === 'conditionsDetailedSummary');

    expect(detailViews).toHaveLength(1);
    expect(detailViews[0]).toEqual(
      expect.objectContaining({
        name: 'conditions-details-widget',
        slots: ['patient-chart-conditions-dashboard-slot', 'consulta-externa-antecedents-slot'],
        privileges: 'app:hoja.clinica.condiciones',
      }),
    );
  });
});
