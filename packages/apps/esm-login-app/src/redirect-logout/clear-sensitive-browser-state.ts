const legacyClinicalWorkflowPrefixes = [
  'openmrs:fastDataEntryWorkflowState:',
  'openmrs:fastDataEntryGroupWorkflowState:',
] as const;

/**
 * Removes browser state that may identify a patient or preserve clinical
 * workflow context across users on a shared workstation.
 */
export function clearSensitiveBrowserState() {
  try {
    globalThis.sessionStorage?.clear();
  } catch {
    // Storage can be unavailable in restricted browser modes. Logout must
    // continue even when the browser refuses access.
  }

  try {
    const keysToRemove: string[] = [];
    for (let index = 0; index < globalThis.localStorage.length; index += 1) {
      const key = globalThis.localStorage.key(index);
      if (key && legacyClinicalWorkflowPrefixes.some((prefix) => key.startsWith(prefix))) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => {
      globalThis.localStorage.removeItem(key);
    });
  } catch {
    // Do not trap a user in an authenticated session because browser storage
    // is unavailable.
  }
}
