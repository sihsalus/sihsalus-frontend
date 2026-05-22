import { consultaExternaDashboardMeta, socialHistoryDashboardMeta } from './dashboard.meta';

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
        title: 'socialHistory',
        path: 'social-history-dashboard',
      }),
    );
  });
});
