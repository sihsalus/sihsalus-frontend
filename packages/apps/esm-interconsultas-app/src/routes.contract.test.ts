import routes from './routes.json';
import { expectKnownGap } from './test-utils/expect-known-gap';

const privileges = {
  homeView: 'app:home.interconsultas',
  homeEdit: 'app:home.interconsultas.editar',
  chartView: 'app:hoja.clinica.interconsultas',
  chartEdit: 'app:hoja.clinica.interconsultas.editar',
} as const;

function extension(name: string) {
  return routes.extensions.find((candidate) => candidate.name === name);
}

function modal(name: string) {
  return routes.modals.find((candidate) => candidate.name === name);
}

describe('interconsultation route and privilege contract', () => {
  it('[AC-02] protects the home entry points with the home view privilege', () => {
    expect(extension('interconsultas-dashboard')).toMatchObject({ privileges: privileges.homeView });
    expect(extension('interconsultas-dashboard-link')).toMatchObject({ privileges: privileges.homeView });
  });

  it('[AC-02] protects patient chart entry points with chart privileges', () => {
    expect(extension('interconsultas-chart-dashboard-link')).toMatchObject({ privileges: privileges.chartView });
    expect(extension('interconsultas-chart-widget')).toMatchObject({ privileges: privileges.chartView });
    expect(extension('request-interconsulta-action-button')).toMatchObject({ privileges: privileges.chartEdit });
    expect(routes.workspaces2).toContainEqual(
      expect.objectContaining({
        name: 'request-interconsulta-workspace',
        privileges: privileges.chartEdit,
      }),
    );
  });

  it('[AC-02] registers every clinical mutation modal behind an edit privilege', () => {
    for (const name of [
      'receive-interconsulta-modal',
      'pickup-interconsulta-modal',
      'reject-interconsulta-modal',
      'respond-interconsulta-modal',
    ]) {
      expect(modal(name)?.privileges).toBe(privileges.chartEdit);
    }
  });

  it('[AC-02] keeps detail access read-only', () => {
    expect(modal('interconsulta-detail-modal')).toMatchObject({ privileges: privileges.chartView });
  });

  it('[AC-02][brecha] lets a home-only operator launch dashboard management modals', async () => {
    await expectKnownGap(() => {
      for (const name of [
        'receive-interconsulta-modal',
        'pickup-interconsulta-modal',
        'reject-interconsulta-modal',
        'respond-interconsulta-modal',
      ]) {
        expect(modal(name)?.privileges).toContain(privileges.homeEdit);
      }
    });
  });

  it('[AC-02][brecha] lets a home-only reader open the detail modal', async () => {
    await expectKnownGap(() => {
      expect(modal('interconsulta-detail-modal')?.privileges).toContain(privileges.homeView);
    });
  });
});
