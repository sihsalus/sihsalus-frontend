import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRegisterModal = vi.hoisted(() => vi.fn());
const mockRegisterWorkspace = vi.hoisted(() => vi.fn());

vi.mock('@openmrs/esm-extensions', () => ({
  attach: vi.fn(),
  registerExtension: vi.fn(),
  registerModal: mockRegisterModal,
  registerWorkspace: mockRegisterWorkspace,
  registerWorkspaceGroup: vi.fn(),
  registerWorkspaceGroups2: vi.fn(),
  registerWorkspaces2: vi.fn(),
  registerWorkspaceWindows2: vi.fn(),
}));

vi.mock('@openmrs/esm-feature-flags', () => ({
  registerFeatureFlag: vi.fn(),
}));

vi.mock('./load-lifecycles', () => ({
  loadLifeCycles: vi.fn(),
}));

import { tryRegisterModal, tryRegisterWorkspace } from './components';

describe('privileged component registration', () => {
  beforeEach(() => {
    mockRegisterModal.mockClear();
    mockRegisterWorkspace.mockClear();
  });

  it('preserves modal privileges in the runtime registry', () => {
    tryRegisterModal('@openmrs/test', {
      name: 'protected-modal',
      component: 'protectedModal',
      privileges: 'app:protected',
    });

    expect(mockRegisterModal).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'protected-modal', privileges: 'app:protected' }),
    );
  });

  it('preserves workspace privileges in the runtime registry', () => {
    tryRegisterWorkspace('@openmrs/test', {
      name: 'protected-workspace',
      component: 'protectedWorkspace',
      title: 'Protected workspace',
      type: 'form',
      groups: [],
      privileges: ['app:protected', 'Task: mutate'],
    });

    expect(mockRegisterWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'protected-workspace',
        privileges: ['app:protected', 'Task: mutate'],
      }),
    );
  });
});
