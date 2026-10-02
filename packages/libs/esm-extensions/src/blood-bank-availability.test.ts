import { type Session, sessionStore } from '@openmrs/esm-api';
import { configInternalStore, provide } from '@openmrs/esm-config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import frontendConfig from '../../../../config/frontend.json';
import bloodBankRoutes from '../../../apps/esm-blood-bank-app/src/routes.json';
import { attach, getAssignedExtensions, registerExtension, registerExtensionSlot } from './extensions';
import { getExtensionInternalStore } from './store';

vi.mock('@openmrs/esm-globals', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@openmrs/esm-globals')>()),
  subscribeConnectivityChanged: vi.fn(),
}));

const slots = [
  ['@sihsalus/esm-home-app', 'homepage-dashboard-slot'],
  ['@sihsalus/esm-primary-navigation-app', 'app-menu-slot'],
] as const;

function setPrivileges(privileges: string[]) {
  sessionStore.setState({
    loaded: true,
    session: {
      sessionId: 'synthetic-blood-bank-session',
      authenticated: true,
      user: {
        uuid: 'synthetic-user',
        roles: [],
        privileges: privileges.map((name) => ({ name, display: name, uuid: `synthetic-${name}` })),
      },
    } as Session,
  });
}

beforeEach(() => {
  getExtensionInternalStore().setState({ extensions: {}, slots: {} });
  configInternalStore.setState({ providedConfigs: [] });
  window.offlineEnabled = false;
  for (const [owner, slot] of slots) {
    registerExtensionSlot(owner, slot);
    for (const extension of bloodBankRoutes.extensions.filter((entry) => entry.slot === slot)) {
      registerExtension({
        ...extension,
        moduleName: '@sihsalus/esm-blood-bank-app',
        meta: extension.meta ?? {},
        load: async () => ({ bootstrap: vi.fn(), mount: vi.fn(), unmount: vi.fn() }),
      });
      attach(slot, extension.name);
    }
    registerExtension({
      name: `${slot}-unrelated`,
      moduleName: owner,
      meta: {},
      load: async () => ({ bootstrap: vi.fn(), mount: vi.fn(), unmount: vi.fn() }),
    });
    attach(slot, `${slot}-unrelated`);
  }
});

afterEach(() => {
  getExtensionInternalStore().setState({ extensions: {}, slots: {} });
  configInternalStore.setState({ providedConfigs: [] });
  sessionStore.setState({ loaded: false, session: null });
});

describe('Blood Bank institutional availability', () => {
  it.each([false, true])('hides both entry points (authorized: %s)', (authorized) => {
    setPrivileges(authorized ? ['app:home.bancoSangre'] : []);
    provide(frontendConfig, 'sihsalus');

    for (const [, slot] of slots) {
      expect(getAssignedExtensions(slot).map(({ id }) => id)).toEqual([`${slot}-unrelated`]);
    }
  });

  it.each([false, true])('preserves the privilege guard if the links are restored (authorized: %s)', (authorized) => {
    setPrivileges(authorized ? ['app:home.bancoSangre'] : []);
    provide(
      Object.fromEntries(slots.map(([owner, slot]) => [owner, { extensionSlots: { [slot]: { remove: [] } } }])),
      'sihsalus',
    );
    for (const [, slot] of slots) {
      const extensions = getAssignedExtensions(slot);
      const bloodBankLinks = extensions.filter(({ moduleName }) => moduleName === '@sihsalus/esm-blood-bank-app');
      expect(bloodBankLinks).toHaveLength(authorized ? 1 : 0);
      expect(extensions.map(({ id }) => id)).toContain(`${slot}-unrelated`);
    }
  });
});
