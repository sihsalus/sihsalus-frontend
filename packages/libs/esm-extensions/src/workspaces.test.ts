import { describe, expect, it, vi } from 'vitest';
import { getWorkspaceRegistration, registerWorkspace } from './workspaces';

describe('legacy workspace registration', () => {
  it('rejects a cross-module registration instead of replacing its component and privileges', () => {
    const name = `colliding-workspace-${crypto.randomUUID()}`;
    registerWorkspace({
      component: 'firstClinicalForm',
      load: vi.fn(),
      moduleName: 'clinical-module-one',
      name,
      privileges: 'clinical.one.edit',
      title: 'First clinical form',
    });

    expect(() =>
      registerWorkspace({
        component: 'secondClinicalForm',
        load: vi.fn(),
        moduleName: 'clinical-module-two',
        name,
        privileges: 'clinical.two.edit',
        title: 'Second clinical form',
      }),
    ).toThrow(/already registered by 'clinical-module-one'/);

    expect(getWorkspaceRegistration(name).moduleName).toBe('clinical-module-one');
    expect(getWorkspaceRegistration(name).privileges).toBe('clinical.one.edit');
  });
});
