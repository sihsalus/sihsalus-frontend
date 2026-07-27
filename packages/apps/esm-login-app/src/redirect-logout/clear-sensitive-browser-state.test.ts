import { clearSensitiveBrowserState } from './clear-sensitive-browser-state';

describe('clearSensitiveBrowserState', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('clears session-scoped patient and UPSS context', () => {
    sessionStorage.setItem('openmrs:visitStoreState', '{"patientUuid":"patient-1"}');
    sessionStorage.setItem('queueLocationUuid', 'upss-1');

    clearSensitiveBrowserState();

    expect(sessionStorage.length).toBe(0);
  });

  it('removes legacy persistent clinical workflows without deleting harmless preferences', () => {
    localStorage.setItem('openmrs:fastDataEntryWorkflowState:user-1', '{"patientUuids":["patient-1"]}');
    localStorage.setItem('openmrs:fastDataEntryGroupWorkflowState:user-2', '{"groupMembers":["patient-2"]}');
    localStorage.setItem('openmrs:loginLocale', 'es');

    clearSensitiveBrowserState();

    expect(localStorage.getItem('openmrs:fastDataEntryWorkflowState:user-1')).toBeNull();
    expect(localStorage.getItem('openmrs:fastDataEntryGroupWorkflowState:user-2')).toBeNull();
    expect(localStorage.getItem('openmrs:loginLocale')).toBe('es');
  });
});
