import routes from './routes.json';

const visitMutationPrivileges = ['Edit Visits', 'Get Visit Attribute Types'];

describe('service queue route privilege contract', () => {
  it('protects both active-visit queue workspaces with visit mutation privileges', () => {
    const legacyWorkspace = routes.workspaces.find(({ name }) => name === 'create-queue-entry-workspace');
    const workspace = routes.workspaces2.find(({ name }) => name === 'queue-patient-search-add-to-queue-workspace');

    expect(legacyWorkspace?.privileges).toEqual(expect.arrayContaining(visitMutationPrivileges));
    expect(workspace?.privileges).toEqual(expect.arrayContaining(visitMutationPrivileges));
  });
});
