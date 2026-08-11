import routes from './routes.json';

describe('appointments route privilege contract', () => {
  it('offers scheduling from patient search only to appointment editors', () => {
    const scheduleAction = routes.extensions.find(({ name }) => name === 'schedule-appointment-patient-search-action');

    expect(scheduleAction).toEqual(
      expect.objectContaining({
        component: 'scheduleAppointmentPatientSearchAction',
        privileges: ['app:home.citas', 'app:home.citas.editar'],
        slot: 'patient-search-actions-slot',
      }),
    );
  });

  it('keeps appointment checkout privileges scoped to their UI context', () => {
    const homeModal = routes.modals.find(({ name }) => name === 'end-appointment-modal');
    const chartModal = routes.modals.find(({ name }) => name === 'patient-chart-end-appointment-modal');

    expect(homeModal?.privileges).toEqual(['app:home.citas', 'app:home.citas.editar.finalizarAtencion']);
    expect(chartModal?.privileges).toEqual([
      'app:hoja.clinica.citas',
      'app:hoja.clinica.citas.editar.finalizarAtencion',
    ]);
  });

  it('protects the complete check-in flow with the home base and edit privileges', () => {
    const checkInRouteNames = [
      'appointment-arrival-modal',
      'appointments-start-visit-workspace',
      'appointments-add-active-visit-to-queue-workspace',
    ];
    const guardedEntries = [...routes.modals, ...routes.workspaces2];

    for (const routeName of checkInRouteNames) {
      const entry = guardedEntries.find(({ name }) => name === routeName);
      expect(entry?.privileges).toEqual(['app:home.citas', 'app:home.citas.editar']);
    }
  });

  it('requires the read privilege together with every appointment write capability', () => {
    const guardedEntries = [...routes.extensions, ...routes.modals, ...routes.workspaces2];

    for (const entry of guardedEntries) {
      const privileges =
        'privileges' in entry
          ? Array.isArray(entry.privileges)
            ? entry.privileges
            : [entry.privileges].filter(Boolean)
          : [];
      if (privileges.includes('app:home.citas.editar')) {
        expect(privileges).toContain('app:home.citas');
      }
      if (privileges.includes('app:hoja.clinica.citas.editar')) {
        expect(privileges).toContain('app:hoja.clinica.citas');
      }
    }
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
        privileges: ['app:home.citas', 'app:home.citas.editar', 'Get People'],
        window: parent?.window,
      }),
    );
    expect(registration).toEqual(
      expect.objectContaining({
        component: '@sihsalus/esm-patient-chart-app#companionPersonRegistrationWorkspace',
        privileges: ['app:home.citas', 'app:home.citas.editar', 'app:opciones.registrarAcompanante', 'Add People'],
        window: parent?.window,
      }),
    );
  });
});
