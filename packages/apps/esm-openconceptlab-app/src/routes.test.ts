import routes from './routes.json';

describe('OCL administrative route contract', () => {
  it('requires the backend concept-management privilege for both discovery and direct access', () => {
    expect(routes.extensions).toContainEqual(
      expect.objectContaining({
        name: 'admin-ocl-card-link',
        privileges: 'Manage Concepts',
      }),
    );
    expect(routes.pages).toContainEqual(
      expect.objectContaining({
        route: 'ocl',
        privileges: 'Manage Concepts',
      }),
    );
  });
});
