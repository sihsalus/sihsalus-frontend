import { useSyncExternalStore } from 'react';

export interface ClinicalSearchTarget {
  kind: 'condition';
  patientUuid: string;
  resourceId: string;
}

let selectedTarget: ClinicalSearchTarget | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return selectedTarget;
}

export function selectClinicalSearchTarget(target: ClinicalSearchTarget) {
  selectedTarget = target;
  listeners.forEach((listener) => {
    listener();
  });
}

export function clearClinicalSearchTarget(target: ClinicalSearchTarget) {
  if (selectedTarget === target) {
    selectedTarget = null;
    listeners.forEach((listener) => {
      listener();
    });
  }
}

export function useClinicalSearchTarget(patientUuid: string, kind: ClinicalSearchTarget['kind']) {
  const target = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return target?.patientUuid === patientUuid && target.kind === kind ? target : null;
}
