import { userHasAccess } from '@openmrs/esm-framework';

import {
  canRegisterCompanionPerson,
  canSearchCompanionPerson,
  companionRegistrationPrivilege,
} from './companion-access';

const mockUserHasAccess = vi.mocked(userHasAccess);
const user = {} as Parameters<typeof userHasAccess>[1];

describe('companion access', () => {
  beforeEach(() => {
    mockUserHasAccess.mockReset();
  });

  it('allows searching only with the native person read privilege', () => {
    mockUserHasAccess.mockImplementation((privilege) => privilege === 'Get People');

    expect(canSearchCompanionPerson(user)).toBe(true);
    expect(canRegisterCompanionPerson(user)).toBe(false);
  });

  it('requires both the frontend capability and native person creation privilege', () => {
    mockUserHasAccess.mockImplementation(
      (privilege) =>
        typeof privilege === 'string' && [companionRegistrationPrivilege, 'Add People'].includes(privilege),
    );

    expect(canRegisterCompanionPerson(user)).toBe(true);
  });

  it.each([
    { privileges: [companionRegistrationPrivilege] },
    { privileges: ['Add People'] },
    { privileges: [] },
  ])('denies registration when only %j is present', ({ privileges }) => {
    mockUserHasAccess.mockImplementation(
      (privilege) => typeof privilege === 'string' && privileges.includes(privilege),
    );

    expect(canRegisterCompanionPerson(user)).toBe(false);
  });
});
