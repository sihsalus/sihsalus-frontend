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

  it('registers clinical identity summary in the patient info slot', () => {
    expect(routes.extensions).toContainEqual(
      expect.objectContaining({
        component: 'clinicalIdentitySummary',
        name: 'admission-clinical-identity-summary',
        slot: 'patient-info-slot',
        online: true,
        offline: true,
      }),
    );
  });
});
