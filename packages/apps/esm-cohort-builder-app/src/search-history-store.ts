import { cloneDeep } from 'lodash-es';
import type { Patient, Query, SearchHistoryItem } from './types';

type StoredSearchHistoryItem = Pick<SearchHistoryItem, 'description' | 'memberIds' | 'parameters'> & {
  patients?: Patient[];
  historyKey: number;
};

// Each entry's memberIds can hold thousands of patient ids, so the history
// must stay bounded for the lifetime of the session.
const MAX_SEARCH_HISTORY_ITEMS = 20;

const searchHistory: StoredSearchHistoryItem[] = [];
let nextHistoryKey = 1;

export function getStoredSearchHistory() {
  return searchHistory.map((historyItem, index) => ({
    ...historyItem,
    id: (index + 1).toString(),
    patients: historyItem.patients ?? [],
    results: (historyItem.memberIds?.length ?? 0).toString(),
  }));
}

export function getStoredSearchHistoryEntry(index: number) {
  return searchHistory[index];
}

export function addStoredSearchHistory(description: string, patients: Patient[], parameters: Query) {
  searchHistory.push({
    historyKey: nextHistoryKey++,
    description,
    memberIds: patients.map((patient) => Number(patient.id)),
    // Keep only the export columns, in memory and within the existing history cap.
    // Re-running the query when downloading would change its original membership.
    patients: patients.map(({ id, patientId, name, age, gender }) => ({ id, patientId, name, age, gender })),
    parameters: cloneDeep(parameters),
  });
  // Consumers address entries by their position from the start, so the oldest
  // entries are the ones dropped when the cap is exceeded.
  if (searchHistory.length > MAX_SEARCH_HISTORY_ITEMS) {
    searchHistory.splice(0, searchHistory.length - MAX_SEARCH_HISTORY_ITEMS);
  }
}

export function removeStoredSearchHistoryEntry(historyKey: number | undefined) {
  const index = searchHistory.findIndex((item) => item.historyKey === historyKey);
  if (index < 0) throw new Error('The search history entry is no longer available.');
  searchHistory.splice(index, 1);
}

export function clearStoredSearchHistory() {
  searchHistory.splice(0, searchHistory.length);
}
