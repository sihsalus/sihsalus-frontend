import { getWorkflowStorageKey, readActiveSessionFormUuids, removeLegacyPersistentWorkflow } from './workflow-storage';

describe('clinical workflow browser storage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('reads only active forms from the authenticated browser session', () => {
    const storageKey = getWorkflowStorageKey('workflow', 'user-1');
    sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        _storageVersion: '1',
        forms: {
          active: { workflowState: 'EDIT_FORM' },
          inactive: { workflowState: '' },
        },
      }),
    );

    expect(readActiveSessionFormUuids('workflow', '1', 'user-1')).toEqual(['active']);
  });

  it('removes malformed session data instead of crashing the forms page', () => {
    const storageKey = getWorkflowStorageKey('workflow', 'user-1');
    sessionStorage.setItem(storageKey, '{not-json');

    expect(readActiveSessionFormUuids('workflow', '1', 'user-1')).toEqual([]);
    expect(sessionStorage.getItem(storageKey)).toBeNull();
  });

  it('removes legacy workflow data persisted across login sessions', () => {
    const storageKey = getWorkflowStorageKey('workflow', 'user-1');
    localStorage.setItem(storageKey, JSON.stringify({ patientUuids: ['patient-1'] }));

    removeLegacyPersistentWorkflow('workflow', 'user-1');

    expect(localStorage.getItem(storageKey)).toBeNull();
  });
});
