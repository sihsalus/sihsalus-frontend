import 'fake-indexeddb/auto';

import { getOfflineDb } from '@openmrs/esm-offline';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  getOfflineDb: (await vi.importActual('@openmrs/esm-offline')).getOfflineDb,
}));

import {
  getDynamicFormDataEntriesFor,
  putDynamicFormDataEntryFor,
  removeDynamicFormDataEntryFor,
} from './offline-form-helpers';

describe('offline form helpers', () => {
  beforeEach(async () => {
    await getOfflineDb().dynamicOfflineData.clear();
  });

  it('returns only form entries for the requested user', async () => {
    await getOfflineDb().dynamicOfflineData.bulkAdd([
      { type: 'form', identifier: 'form-a', users: ['user-a'] },
      { type: 'form', identifier: 'form-b', users: ['user-b'] },
      { type: 'patient', identifier: 'patient-a', users: ['user-a'] },
      { type: 'form', identifier: 'form-shared', users: ['user-a', 'user-b'] },
    ]);

    const entries = await getDynamicFormDataEntriesFor('user-a');

    expect(entries.map((entry) => entry.identifier).sort((a, b) => a.localeCompare(b))).toEqual([
      'form-a',
      'form-shared',
    ]);
  });

  it('adds and removes user membership without duplicating rows', async () => {
    await putDynamicFormDataEntryFor('user-a', 'form-a');
    await putDynamicFormDataEntryFor('user-b', 'form-a');
    await putDynamicFormDataEntryFor('user-a', 'form-a');

    let entries = await getOfflineDb().dynamicOfflineData.toArray();
    expect(entries).toHaveLength(1);
    expect(entries[0].users.sort()).toEqual(['user-a', 'user-b']);

    await removeDynamicFormDataEntryFor('user-a', 'form-a');
    entries = await getOfflineDb().dynamicOfflineData.toArray();
    expect(entries).toHaveLength(1);
    expect(entries[0].users).toEqual(['user-b']);

    await removeDynamicFormDataEntryFor('user-b', 'form-a');
    entries = await getOfflineDb().dynamicOfflineData.toArray();
    expect(entries).toHaveLength(0);
  });
});
