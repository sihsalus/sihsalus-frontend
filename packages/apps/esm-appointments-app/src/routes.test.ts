import routes from './routes.json';

describe('appointments route privilege contract', () => {
  it('offers scheduling from patient search only to appointment editors', () => {
    const scheduleAction = routes.extensions.find(({ name }) => name === 'schedule-appointment-patient-search-action');

    expect(scheduleAction).toEqual(
      expect.objectContaining({
        component: 'scheduleAppointmentPatientSearchAction',
        privileges: 'app:home.citas.editar',
        slot: 'patient-search-actions-slot',
      }),
    );
  });

  it('keeps appointment companion workspaces in the same window as the start-visit parent', () => {
    const parent = routes.workspaces2.find(({ name }) => name === 'appointments-start-visit-workspace');
    const search = routes.workspaces2.find(({ name }) => name === 'appointments-visit-companion-search-workspace');
    const registration = routes.workspaces2.find(
      ({ name }) => name === 'appointments-visit-companion-registration-workspace',
    );

    expect(parent?.window).toBe('appointments-window');
    expect(search).toEqual(
      expect.objectContaining({
        component: '@sihsalus/esm-patient-chart-app#companionPersonSearchWorkspace',
        privileges: ['app:home.citas.editar', 'Get People'],
        window: parent?.window,
      }),
    );
    expect(registration).toEqual(
      expect.objectContaining({
        component: '@sihsalus/esm-patient-chart-app#companionPersonRegistrationWorkspace',
        privileges: ['app:home.citas.editar', 'app:opciones.registrarAcompanante', 'Add People'],
        window: parent?.window,
      }),
    );
  });
});
