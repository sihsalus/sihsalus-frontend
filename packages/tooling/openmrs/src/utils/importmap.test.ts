import { describe, expect, it } from 'vitest';

import { checkImportmapJson, checkRoutesJson } from './importmap';

describe('OpenMRS 10 import map and route validation', () => {
  it('requires an object of imports', () => {
    expect(checkImportmapJson('{"imports":{"@openmrs/esm-framework":"/framework.js"}}')).toBe(true);
    expect(checkImportmapJson('{"imports":null}')).toBe(false);
    expect(checkImportmapJson('{"imports":[]}')).toBe(false);
    expect(checkImportmapJson('null')).toBe(false);
  });

  it('requires a routes registry with object entries', () => {
    expect(checkRoutesJson('{"@openmrs/esm-framework":{"routes":[]}}')).toBe(true);
    expect(checkRoutesJson('{"@openmrs/esm-framework":null}')).toBe(false);
    expect(checkRoutesJson('{"@openmrs/esm-framework":[]}')).toBe(false);
    expect(checkRoutesJson('null')).toBe(false);
  });
});
