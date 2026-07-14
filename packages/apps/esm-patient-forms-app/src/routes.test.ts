import routes from './routes.json';

const clinicalFormsPrivilege = 'app:hoja.clinica.formulariosClinicos';

describe('clinical forms route access', () => {
  it('protects patient-chart, ward, legacy, and extension entry points consistently', () => {
    const protectedExtensionNames = ['clinical-forms-workspaceExtension'];
    const protectedWorkspaceNames = ['ward-patient-form-entry-workspace', 'ward-patient-html-form-entry-workspace'];
    const protectedWorkspace2Names = [
      'clinical-forms-workspace',
      'patient-form-entry-workspace',
      'patient-form-entry-workspace-v2',
      'patient-html-form-entry-workspace',
    ];

    expect(routes.extensions.filter(({ name }) => protectedExtensionNames.includes(name))).toEqual(
      expect.arrayContaining(
        protectedExtensionNames.map((name) => expect.objectContaining({ name, privileges: clinicalFormsPrivilege })),
      ),
    );
    expect(routes.workspaces.filter(({ name }) => protectedWorkspaceNames.includes(name))).toEqual(
      expect.arrayContaining(
        protectedWorkspaceNames.map((name) => expect.objectContaining({ name, privileges: clinicalFormsPrivilege })),
      ),
    );
    expect(routes.workspaces2.filter(({ name }) => protectedWorkspace2Names.includes(name))).toEqual(
      expect.arrayContaining(
        protectedWorkspace2Names.map((name) => expect.objectContaining({ name, privileges: clinicalFormsPrivilege })),
      ),
    );
    expect(routes.workspaceWindows2).toContainEqual(
      expect.objectContaining({ name: 'patient-chart-clinical-forms', privileges: clinicalFormsPrivilege }),
    );
  });
});
