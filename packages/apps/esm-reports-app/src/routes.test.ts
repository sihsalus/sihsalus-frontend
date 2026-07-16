import routes from './routes.json';

describe('reports route contract', () => {
  it('keeps every report view below the guarded reports root', () => {
    expect(routes.pages).toEqual([{ component: 'root', route: 'reports' }]);
  });
});
