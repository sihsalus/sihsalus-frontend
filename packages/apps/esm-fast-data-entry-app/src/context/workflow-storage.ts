interface StoredWorkflow {
  _storageVersion?: unknown;
  forms?: Record<string, { workflowState?: unknown }>;
}

export function getWorkflowStorageKey(storageName: string, userUuid: string) {
  return `${storageName}:${userUuid}`;
}

export function removeLegacyPersistentWorkflow(storageName: string, userUuid: string) {
  localStorage.removeItem(getWorkflowStorageKey(storageName, userUuid));
}

export function readActiveSessionFormUuids(storageName: string, storageVersion: string, userUuid?: string) {
  if (!userUuid) {
    return [];
  }

  const storageKey = getWorkflowStorageKey(storageName, userUuid);
  const savedData = sessionStorage.getItem(storageKey);

  if (!savedData) {
    return [];
  }

  try {
    const workflow = JSON.parse(savedData) as StoredWorkflow;
    if (workflow._storageVersion !== storageVersion || !workflow.forms || typeof workflow.forms !== 'object') {
      return [];
    }

    return Object.entries(workflow.forms)
      .filter(([, form]) => Boolean(form && typeof form === 'object' && form.workflowState))
      .map(([formUuid]) => formUuid);
  } catch {
    sessionStorage.removeItem(storageKey);
    return [];
  }
}
