import { describe, expect, it } from 'vitest';
import { getMissingEffectivePrivileges } from './e2e-effective-privileges';

describe('effective OpenMRS privileges from verified user metadata', () => {
  const required = ['Get Patients', 'Add Orders'];

  it('accepts explicit non-retired privileges and reports every missing grant', () => {
    expect(getMissingEffectivePrivileges(required, [{ name: 'Get Patients' }], [])).toEqual(['Add Orders']);
    expect(
      getMissingEffectivePrivileges(
        required,
        required.map((name) => ({ name, retired: false })),
        [],
      ),
    ).toEqual([]);
    expect(getMissingEffectivePrivileges(required, [{ name: 'Get Patients', retired: true }], [])).toEqual(required);
  });

  it('recognizes the active core System Developer role without enumerating explicit grants', () => {
    expect(getMissingEffectivePrivileges(required, [], [{ name: 'System Developer', retired: false }])).toEqual([]);
  });

  it.each(
    [
      undefined,
      null,
      { name: 'System Developer', retired: false },
      [null],
      [{ display: 'System Developer', retired: false }],
      [{ name: 'System Developer' }],
      [{ name: 'System Developer', retired: true }],
      [{ name: 'System Developer', retired: 'false' }],
      [{ name: 'Frontend System Developer', retired: false }],
    ].map((roles) => ({ roles })),
  )('does not infer effective privileges from incomplete, retired or aliased roles ($roles)', ({ roles }) => {
    expect(getMissingEffectivePrivileges(required, undefined, roles)).toEqual(required);
  });
});
