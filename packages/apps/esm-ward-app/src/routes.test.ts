import routes from './routes.json';

const clinicalFormsPrivilege = 'app:hoja.clinica.formulariosClinicos';

describe('ward clinical forms route access', () => {
  it('protects the window and every workspace in its launch chain', () => {
    const protectedWorkspaceNames = ['ward-patient-clinical-forms-workspace', 'ward-patient-form-entry-workspace'];

    expect(routes.workspaces2.filter(({ name }) => protectedWorkspaceNames.includes(name))).toEqual(
      expect.arrayContaining(
        protectedWorkspaceNames.map((name) => expect.objectContaining({ name, privileges: clinicalFormsPrivilege })),
      ),
    );
    expect(routes.workspaceWindows2).toContainEqual(
      expect.objectContaining({ name: 'ward-patient-clinical-forms', privileges: clinicalFormsPrivilege }),
    );
  });
});
