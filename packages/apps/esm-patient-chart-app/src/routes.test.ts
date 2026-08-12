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

  it('requires clinical chart, patient vital status, and backend person-edit access to mark a patient alive or deceased', () => {
    const patientVitalStatusPrivileges = [
      'app:hoja.clinica',
      'app:hoja.clinica.estadoVitalPaciente',
      'Edit People',
    ];
    const patientVitalStatusButtons = routes.extensions.filter(({ name }) =>
      ['mark-alive-button', 'mark-patient-deceased-button'].includes(name),
    );
    const markAliveModal = routes.modals.find(({ name }) => name === 'mark-patient-alive-modal');
    const markDeceasedWorkspace = routes.workspaces2.find(
      ({ name }) => name === 'mark-patient-deceased-workspace-form',
    );

    expect(patientVitalStatusButtons).toHaveLength(2);
    patientVitalStatusButtons.forEach((extension) => {
      expect(extension.privileges).toEqual(patientVitalStatusPrivileges);
    });
    expect(markAliveModal?.privileges).toEqual(patientVitalStatusPrivileges);
    expect(markDeceasedWorkspace?.privileges).toEqual(patientVitalStatusPrivileges);
  });
});
