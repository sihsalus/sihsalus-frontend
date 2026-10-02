import { consultaExternaDashboardMeta, socialHistoryDashboardMeta } from './dashboard.meta';
import routes from './routes.json';

describe('consulta ambulatoria dashboard meta', () => {
  it('registers the expected dashboard entries', () => {
    expect(consultaExternaDashboardMeta).toEqual(
      expect.objectContaining({
        icon: 'omrs-icon-document',
        slot: 'patient-chart-consulta-externa-slot',
        columns: 1,
        title: 'consultaExterna',
        path: 'consulta-externa',
      }),
    );

    expect(socialHistoryDashboardMeta).toEqual(
      expect.objectContaining({
        icon: 'omrs-icon-sticky-note-add',
        slot: 'patient-chart-social-history-dashboard-slot',
        columns: 1,
        title: 'antecedents',
        path: 'social-history-dashboard',
      }),
    );
  });

  it('shares the grouped view while retaining the original read guards and historical URL', () => {
    expect(routes.extensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'antecedents-dashboard',
          slot: 'patient-chart-antecedents-slot',
          component: 'antecedentsDashboard',
          privileges: 'app:hoja.clinica.condiciones',
        }),
        expect.objectContaining({
          name: 'social-history-dashboard',
          component: 'inPatientClinicalEncounter',
          privileges: 'app:hoja.clinica.historiaSocial',
        }),
        expect.objectContaining({
          name: 'social-history-dashboard-link',
          privileges: 'app:hoja.clinica.historiaSocial',
          meta: expect.objectContaining({ title: 'antecedents', path: 'social-history-dashboard' }),
        }),
      ]),
    );
  });
});
