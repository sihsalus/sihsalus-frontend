import routes from './routes.json';

describe('patient chart route privilege contract', () => {
  it('protects companion lookup and registration with their exact capabilities', () => {
    const searchWorkspace = routes.workspaces2.find(({ name }) => name === 'visit-companion-search-workspace');
    const registrationWorkspace = routes.workspaces2.find(
      ({ name }) => name === 'visit-companion-registration-workspace',
    );

    expect(searchWorkspace?.privileges).toBe('Get People');
    expect(registrationWorkspace?.privileges).toEqual(
      expect.arrayContaining(['app:opciones.registrarAcompanante', 'Add People']),
    );
  });

  it('requires clinical scope as well as visit editing for visit closure actions', () => {
    const closurePrivileges = ['app:hoja.clinica', 'app:hoja.clinica.visitas.editar'];
    const closureExtensions = routes.extensions.filter(({ name }) =>
      ['stop-visit-button', 'stop-visit-button-patient-search', 'cancel-visit-button'].includes(name),
    );

    expect(closureExtensions).toHaveLength(4);
    closureExtensions.forEach((extension) => {
      expect(extension.privileges).toEqual(closurePrivileges);
    });
    expect(routes.modals.find(({ name }) => name === 'end-visit-dialog')?.privileges).toEqual(closurePrivileges);
    expect(routes.modals.find(({ name }) => name === 'cancel-visit-dialog')?.privileges).toEqual(closurePrivileges);
  });
});
