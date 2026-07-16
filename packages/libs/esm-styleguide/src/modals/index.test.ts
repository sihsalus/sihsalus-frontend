import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetModalRegistration = vi.hoisted(() => vi.fn());
const mockUserCanLaunch = vi.hoisted(() => vi.fn());

vi.mock('@openmrs/esm-extensions', () => ({
  getModalRegistration: mockGetModalRegistration,
}));

vi.mock('../access', () => ({
  userCanLaunch: mockUserCanLaunch,
}));

vi.mock('@openmrs/esm-error-handling', () => ({
  reportError: vi.fn(),
}));

vi.mock('single-spa', () => ({
  mountRootParcel: vi.fn(),
}));

import { showModal } from './index';

describe('showModal privilege enforcement', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockGetModalRegistration.mockReset();
    mockUserCanLaunch.mockReset();
  });

  it('does not enqueue a modal when the user lacks its declared privilege', () => {
    const load = vi.fn();
    mockGetModalRegistration.mockReturnValue({
      name: 'protected-modal',
      moduleName: '@openmrs/test',
      privileges: 'app:protected',
      load,
    });
    mockUserCanLaunch.mockReturnValue(false);
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(() => showModal('protected-modal')).not.toThrow();

    expect(mockUserCanLaunch).toHaveBeenCalledWith('app:protected');
    expect(load).not.toHaveBeenCalled();
    expect(warning).toHaveBeenCalledWith('Access denied while launching modal "protected-modal".');
  });
});
