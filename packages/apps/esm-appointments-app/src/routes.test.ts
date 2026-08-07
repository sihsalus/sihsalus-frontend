import routes from './routes.json';

describe('appointments route privilege contract', () => {
  it('offers scheduling from patient search only to appointment editors', () => {
    const scheduleAction = routes.extensions.find(({ name }) => name === 'schedule-appointment-patient-search-action');

    expect(scheduleAction).toEqual(
      expect.objectContaining({
        component: 'scheduleAppointmentPatientSearchAction',
        privileges: 'app:home.citas.editar',
        slot: 'patient-search-actions-slot',
      }),
    );
  });
});
