import routes from './routes.json';

const visitMutationPrivileges = ['Edit Visits', 'Get Visit Attribute Types'];

describe('service queue route privilege contract', () => {
  it('exposes the active queue count on the home metrics slot', () => {
    expect(routes.extensions.find(({ name }) => name === 'patients-in-queue-tile')).toMatchObject({
      component: 'homePatientsInQueueTile',
      slot: 'home-metrics-tiles-slot',
      privileges: 'app:home.colasAtencion',
    });
  });

  it('protects both active-visit queue workspaces with visit mutation privileges', () => {
    const legacyWorkspace = routes.workspaces.find(({ name }) => name === 'create-queue-entry-workspace');
    const workspace = routes.workspaces2.find(({ name }) => name === 'queue-patient-search-add-to-queue-workspace');

    expect(legacyWorkspace?.privileges).toEqual(expect.arrayContaining(visitMutationPrivileges));
    expect(workspace?.privileges).toEqual(expect.arrayContaining(visitMutationPrivileges));
  });

  it('requires the edit privilege on every queue mutation surface', () => {
    const editingSurfaces = [
      ...routes.extensions.filter(({ name, privileges }) =>
        name !== 'visit-form-queue-fields' && Array.isArray(privileges)
          ? privileges.includes('Manage Queue Entries')
          : false,
      ),
      ...routes.modals,
      ...routes.workspaces.filter(({ name }) => name !== 'service-queues-linelist-filter'),
      ...routes.workspaces2.filter(({ name }) =>
        [
          'queue-patient-search-workspace',
          'queue-patient-search-add-to-queue-workspace',
          'queue-patient-search-start-visit-workspace',
          'service-queues-service-form',
          'service-queues-room-workspace',
        ].includes(name),
      ),
    ];

    expect(editingSurfaces.length).toBeGreaterThan(0);
    editingSurfaces.forEach(({ privileges }) => {
      expect(Array.isArray(privileges) ? privileges : [privileges]).toContain('app:home.colasAtencion.editar');
    });
  });

  it('uses clinical privileges for clinical workspaces embedded in queues', () => {
    const vitalsWorkspace = routes.workspaces2.find(({ name }) => name === 'service-queues-patient-vitals-workspace');
    const visitNotesWorkspace = routes.workspaces2.find(({ name }) => name === 'service-queues-visit-notes-workspace');

    expect(vitalsWorkspace?.privileges).toContain('app:hoja.clinica.signosVitales.editar');
    expect(visitNotesWorkspace?.privileges).toContain('app:hoja.clinica.resumenConsulta.editar');
  });

  it('requires native catalog permissions on queue and room administration workspaces', () => {
    const queueWorkspaces = [...routes.workspaces, ...routes.workspaces2].filter(
      ({ name }) => name === 'service-queues-service-form',
    );
    const roomWorkspaces = [...routes.workspaces, ...routes.workspaces2].filter(
      ({ name }) => name === 'service-queues-room-workspace',
    );

    queueWorkspaces.forEach(({ privileges }) => {
      expect(privileges).toEqual(
        expect.arrayContaining(['app:home.colasAtencion.editar', 'Get Queues', 'Manage Queues']),
      );
    });
    roomWorkspaces.forEach(({ privileges }) => {
      expect(privileges).toEqual(
        expect.arrayContaining([
          'app:home.colasAtencion.editar',
          'Get Queue Rooms',
          'Get Queues',
          'Manage Queue Rooms',
        ]),
      );
    });
  });
});
