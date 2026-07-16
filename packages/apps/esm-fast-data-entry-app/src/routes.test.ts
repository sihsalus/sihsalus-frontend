import routes from './routes.json';

describe('fast data entry route contract', () => {
  it('only mounts below the forms path', () => {
    expect(routes.pages).toEqual([
      {
        component: 'root',
        route: 'forms',
        online: true,
        offline: true,
      },
    ]);
  });
});
