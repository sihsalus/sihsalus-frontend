import { createGlobalStore, createUseStore } from '@openmrs/esm-framework';
import type { StoreApi } from 'zustand';
import { getOrCreateGlobalSingleton } from '../store/global-singleton';

type NavGroupStore = {
  navGroups: Array<string>;
};

const navGroupStore = getOrCreateGlobalSingleton<StoreApi<NavGroupStore>>('nav-groups', () =>
  createGlobalStore<NavGroupStore>('nav-groups', { navGroups: [] }),
);

export function registerNavGroup(slotName: string): void {
  const store = navGroupStore.getState();
  const navGroups = Array.isArray(store.navGroups) ? store.navGroups : [];

  if (navGroups.includes(slotName)) {
    return;
  }

  navGroupStore.setState({ navGroups: [slotName, ...navGroups] });
}

export const useNavGroups = createUseStore(navGroupStore);
