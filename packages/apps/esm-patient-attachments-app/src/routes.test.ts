import routes from './routes.json';

describe('attachments backend contract', () => {
  // The range has to admit a stock upstream Attachments 4.x. Only uploading a
  // supplemental laboratory PDF needs the SIH Salus release, and that path
  // ships behind a runtime flag that defaults to false; declaring the fork as a
  // hard requirement reported the whole module as version-incompatible on every
  // upstream deployment, which is a permanent false alarm in Implementer Tools.
  //
  // Asserted as a literal rather than through isVersionSatisfied because the
  // framework test stub hardcodes that helper to return true, so a semantic
  // check here would pass no matter what the range said.
  it('accepts both upstream 4.x and the SIH Salus release', () => {
    expect(routes.backendDependencies.attachments).toBe('>=4.0.0 <5.0.0');
  });
});
