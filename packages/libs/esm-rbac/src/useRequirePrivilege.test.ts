import type { Privilege } from '@openmrs/esm-framework';
import { describe, expect, it } from 'vitest';
import { checkRequirePrivilege } from './useRequirePrivilege';

function createPrivilege(name: string, display: string): Privilege {
  return {
    uuid: display,
    name,
    display,
  };
}

describe('checkRequirePrivilege', () => {
  it('matches privileges by display to stay aligned with the OpenMRS framework', () => {
    const privileges = [createPrivilege('internal-name', 'Get Queue Entries')];

    expect(checkRequirePrivilege(privileges, ['Get Queue Entries'])).toEqual({ status: 'authorized' });
    expect(checkRequirePrivilege(privileges, ['internal-name'])).toEqual({
      status: 'unauthorized',
      missingPrivilege: ['internal-name'],
    });
  });
});
