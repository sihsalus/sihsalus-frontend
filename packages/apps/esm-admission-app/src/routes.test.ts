import routes from './routes.json';

describe('routes.json', () => {
  it('registers the admission root page', () => {
    expect(routes.pages).toContainEqual(
      expect.objectContaining({
        component: 'root',
        route: 'admission',
        online: true,
        offline: false,
      }),
    );
  });

  it('registers navigation entry points for admission workflows', () => {
    expect(routes.extensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          component: 'admissionAppMenuLink',
          name: 'admission-app-menu-item',
          slot: 'app-menu-slot',
        }),
        expect.objectContaining({
          component: 'admissionHomeDashboardLink',
          name: 'admission-home-dashboard-link',
          slot: 'homepage-dashboard-slot',
        }),
        expect.objectContaining({
          component: 'admissionMergePatientsAction',
          name: 'admission-merge-patients-action',
          slot: 'top-nav-actions-slot',
        }),
      ]),
    );
  });

  it('does not register patient banner identity extensions from admission', () => {
    expect(routes.extensions).not.toContainEqual(
      expect.objectContaining({
        slot: 'patient-info-slot',
      }),
    );
  });
});
