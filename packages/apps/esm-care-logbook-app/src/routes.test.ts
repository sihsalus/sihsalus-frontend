import routes from './routes.json';

describe('routes.json', () => {
  it('registers the care logbook root page on the legacy admission route', () => {
    expect(routes.pages).toContainEqual(
      expect.objectContaining({
        component: 'root',
        route: 'admission',
        online: true,
        offline: false,
      }),
    );
  });

  it('registers navigation entry points for care logbook workflows', () => {
    expect(routes.extensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          component: 'careLogbookAppMenuLink',
          name: 'care-logbook-app-menu-item',
          slot: 'app-menu-slot',
        }),
        expect.objectContaining({
          component: 'careLogbookHomeDashboardLink',
          name: 'care-logbook-home-dashboard-link',
          slot: 'homepage-dashboard-slot',
        }),
        expect.objectContaining({
          component: 'careLogbookMergePatientsAction',
          name: 'care-logbook-merge-patients-action',
          slot: 'top-nav-actions-slot',
        }),
      ]),
    );
  });

  it('does not register patient banner identity extensions from the care logbook', () => {
    expect(routes.extensions).not.toContainEqual(
      expect.objectContaining({
        slot: 'patient-info-slot',
      }),
    );
  });
});
