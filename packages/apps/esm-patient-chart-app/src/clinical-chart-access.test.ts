import { describe, expect, it } from 'vitest';

import { hasClinicalChartAccess } from './clinical-chart-access';

describe('hasClinicalChartAccess', () => {
  it.each([
    ['current privilege in name', { privileges: [{ name: 'app:hoja.clinica' }], roles: [] }],
    ['current privilege in display', { privileges: [{ display: 'app:hoja.clinica' }], roles: [] }],
    ['legacy privilege', { privileges: [{ display: 'app:clinical.chart' }], roles: [] }],
    ['System Developer role', { privileges: [], roles: [{ display: 'System Developer' }] }],
    [
      'localized System Developer role',
      { privileges: [], roles: [{ name: 'System Developer', display: 'Desarrollador del sistema' }] },
    ],
    [
      'inherited superuser role',
      { privileges: [], roles: [{ display: 'Application: Has Super User Privileges' }] },
    ],
  ])('allows access for %s', (_case, user) => {
    expect(hasClinicalChartAccess(user)).toBe(true);
  });

  it.each([
    ['no user', undefined],
    ['no privileges', { privileges: [], roles: [] }],
    ['only a child privilege', { privileges: [{ display: 'app:hoja.clinica.resumen' }], roles: [] }],
    [
      'unrelated administrative role',
      { privileges: [], roles: [{ display: 'Organizational: System Administrator' }] },
    ],
  ])('denies access for %s', (_case, user) => {
    expect(hasClinicalChartAccess(user)).toBe(false);
  });
});
