/** @module @category Extension */

import { type ExtensionStore, getExtensionStore } from '@openmrs/esm-extensions';
import { isEqual } from 'lodash-es';
import { useEffect, useState } from 'react';

/**
 * Gets the assigned extension ids for a given extension slot name.
 * Does not consider if offline or online.
 * @param slotName The name of the slot to get the assigned IDs for.
 *
 * @deprecated Use `useAssignedExtensions`
 */
export function useAssignedExtensionIds(slotName: string) {
  const [ids, setIds] = useState<Array<string>>([]);

  useEffect(() => {
    const store = getExtensionStore();
    const update = (state: ExtensionStore) => {
      const newIds = state.slots[slotName]?.assignedExtensions.map((e) => e.id) ?? [];
      setIds((prev) => (isEqual(newIds, prev) ? prev : newIds));
    };
    // subscribe only fires on changes, so the current state must be applied up front
    update(store.getState());
    return store.subscribe(update);
  }, [slotName]);

  return ids;
}
