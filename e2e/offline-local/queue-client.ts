import { OfflineDb } from '../../packages/libs/esm-offline/src/offline-db';
import { readOfflineProfile } from '../../packages/libs/esm-offline/src/offline-profile-db';
import {
  getFullSynchronizationItems,
  queueSynchronizationItem,
  runSynchronization,
  setupOfflineSync,
} from '../../packages/libs/esm-offline/src/sync';
import type { OfflineHarness } from './contract';
import { setUser } from './session';

const types = ['registration', 'form', 'vitals', 'triage'] as const;
for (const type of types) {
  // Synthetic adapters exercise the real durable queue across browser reloads.
  // Clinical producers/reconciliation are separately covered by their workspace suites.
  setupOfflineSync(type, [], async (item: { uuid: string; checkpoint?: boolean }, options) => {
    const recovered = await fetch(`/openmrs/ws/test/${item.uuid}`, { cache: 'no-store' });
    if (recovered.status === 404 && !item.checkpoint) {
      if (!options.updateContent) throw new Error('Synthetic checkpoint unavailable');
      await options.updateContent((current) => ({ ...current, checkpoint: true }));
      const created = await fetch(`/openmrs/ws/test/${item.uuid}`, { method: 'POST', body: JSON.stringify(item) });
      if (!created.ok) throw new Error('Synthetic write rejected');
    } else if (!recovered.ok) throw new Error('Synthetic result unknown');
  });
}
const harness = {
  setUser,
  profile: readOfflineProfile,
  queue: getFullSynchronizationItems,
  sync: runSynchronization,
  add: async () => {
    for (const type of types)
      await queueSynchronizationItem(type, { uuid: `synthetic-${type}` }, { id: `synthetic-${type}` });
  },
  clearQueue: async () => {
    const db = new OfflineDb();
    await db.syncQueue.clear();
    db.close();
  },
  message: (type: string) =>
    new Promise((resolve) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => {
        channel.port1.close();
        resolve({ success: false });
      }, 10000);
      channel.port1.onmessage = (event) => {
        clearTimeout(timer);
        channel.port1.close();
        resolve(event.data);
      };
      const controller = navigator.serviceWorker.controller;
      if (controller) {
        controller.postMessage({ type }, [channel.port2]);
      } else {
        clearTimeout(timer);
        channel.port1.close();
        channel.port2.close();
        resolve({ success: false });
      }
    }),
} satisfies OfflineHarness;
Object.assign(window, { offlineHarness: harness });
