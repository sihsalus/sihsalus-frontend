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
});
