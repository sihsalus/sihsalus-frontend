import routes from './routes.json';
import { serviceQueuesPatientVitalsEditPrivileges, serviceQueuesVisitNotesEditPrivileges } from './constants';

const visitMutationPrivileges = ['Edit Visits', 'Get Visit Attribute Types'];

describe('service queue route privilege contract', () => {
  it('protects both active-visit queue workspaces with visit mutation privileges', () => {
    const legacyWorkspace = routes.workspaces.find(({ name }) => name === 'create-queue-entry-workspace');
    const workspace = routes.workspaces2.find(({ name }) => name === 'queue-patient-search-add-to-queue-workspace');

    expect(legacyWorkspace?.privileges).toEqual(expect.arrayContaining(visitMutationPrivileges));
    expect(workspace?.privileges).toEqual(expect.arrayContaining(visitMutationPrivileges));
  });

  it('allows admission users to load operational queue editing surfaces', () => {
    const embeddedClinicalWorkspaces = new Set([
      'service-queues-patient-vitals-workspace',
      'service-queues-visit-notes-workspace',
    ]);
    const editingSurfaces = [
      ...routes.extensions.filter(({ name }) => name.includes('queue') || name.includes('visit')),
      ...routes.modals,
      ...routes.workspaces,
      ...routes.workspaces2.filter(({ name }) => !embeddedClinicalWorkspaces.has(name)),
    ];

    expect(editingSurfaces.some(({ privileges }) => JSON.stringify(privileges).includes('colasAtencion.editar'))).toBe(
      false,
    );
  });

  it('requires both queue and clinical privileges for embedded clinical editors', () => {
    const vitalsWorkspace = routes.workspaces2.find(({ name }) => name === 'service-queues-patient-vitals-workspace');
    const notesWorkspace = routes.workspaces2.find(({ name }) => name === 'service-queues-visit-notes-workspace');

    expect(vitalsWorkspace?.privileges).toEqual(expect.arrayContaining(serviceQueuesPatientVitalsEditPrivileges));
    expect(notesWorkspace?.privileges).toEqual(expect.arrayContaining(serviceQueuesVisitNotesEditPrivileges));
  });
});
