import routes from './routes.json';

describe('visit note route privilege contract', () => {
  it('requires the edit privilege on both the workspace and its window', () => {
    const workspace = routes.workspaces2.find(({ name }) => name === 'visit-notes-form-workspace');
    const window = routes.workspaceWindows2.find(({ name }) => name === 'visit-note');

    expect(workspace?.privileges).toBe('app:hoja.clinica.resumenConsulta.editar');
    expect(window?.privileges).toBe('app:hoja.clinica.resumenConsulta.editar');
  });
});
