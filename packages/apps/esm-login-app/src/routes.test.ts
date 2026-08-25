import routes from './routes.json';

describe('login routes', () => {
  it('mounts the forced-password guard on login and deep links, but preserves logout', () => {
    const guard = routes.pages.find((page) => page.component === 'forcedPasswordChangeGate');
    expect(guard).toBeDefined();

    const routeRegex = new RegExp((guard as { routeRegex: string }).routeRegex);
    expect(routeRegex.test('login')).toBe(true);
    expect(routeRegex.test('patient/synthetic-patient/chart')).toBe(true);
    expect(routeRegex.test('home/care-logbook')).toBe(true);
    expect(routeRegex.test('login/forced-password')).toBe(true);
    expect(routeRegex.test('logout')).toBe(false);
    expect(guard).toMatchObject({ online: true, offline: true });
  });

  it('keeps every password-changing entry point online-only', () => {
    expect(routes.pages.find((page) => 'route' in page && page.route === 'change-password')).toMatchObject({
      online: true,
      offline: false,
    });
    expect(routes.extensions.find((extension) => extension.name === 'password-changer')).toMatchObject({
      online: true,
      offline: false,
    });
  });
});
