import { describe, expect, it, vi } from 'vitest';
import { getModalRegistration, registerModal } from './modals';

describe('modal registration', () => {
  it('preserves the privileges declared by the modal route', () => {
    const name = `protected-modal-${crypto.randomUUID()}`;
    const privileges = ['View Visits', 'Edit Visits'];

    registerModal({
      name,
      moduleName: 'test-module',
      load: vi.fn(),
      privileges,
    });

    expect(getModalRegistration(name)?.privileges).toEqual(privileges);
  });

  it('rejects a cross-module registration instead of replacing its component and privileges', () => {
    const name = `colliding-modal-${crypto.randomUUID()}`;
    registerModal({ name, moduleName: 'clinical-module-one', load: vi.fn(), privileges: 'clinical.one.edit' });

    expect(() =>
      registerModal({ name, moduleName: 'clinical-module-two', load: vi.fn(), privileges: 'clinical.two.edit' }),
    ).toThrow(/already registered by 'clinical-module-one'/);

    expect(getModalRegistration(name)?.moduleName).toBe('clinical-module-one');
    expect(getModalRegistration(name)?.privileges).toBe('clinical.one.edit');
  });
});
