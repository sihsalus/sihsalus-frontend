import type { Patient, Query, SearchHistoryItem } from './types';

type StoredSearchHistoryItem = Pick<SearchHistoryItem, 'description' | 'memberIds' | 'parameters'>;

// Each entry's memberIds can hold thousands of patient ids, so the history
// must stay bounded for the lifetime of the session.
const MAX_SEARCH_HISTORY_ITEMS = 20;

const searchHistory: StoredSearchHistoryItem[] = [];

export function getStoredSearchHistory() {
  return searchHistory.map((historyItem, index) => ({
    ...historyItem,
    id: (index + 1).toString(),
    patients: [],
    results: (historyItem.memberIds?.length ?? 0).toString(),
  }));
}

export function getStoredSearchHistoryEntry(index: number) {
  return searchHistory[index];
}

export function addStoredSearchHistory(description: string, patients: Patient[], parameters: Query) {
  searchHistory.push({
    description,
    memberIds: patients.map((patient) => parseInt(patient.id, 10)),
    parameters,
  });
  // Consumers address entries by their position from the start, so the oldest
  // entries are the ones dropped when the cap is exceeded.
  if (searchHistory.length > MAX_SEARCH_HISTORY_ITEMS) {
    searchHistory.splice(0, searchHistory.length - MAX_SEARCH_HISTORY_ITEMS);
  }
}

export function replaceStoredSearchHistory(updatedSearchHistory: Array<StoredSearchHistoryItem>) {
  searchHistory.splice(0, searchHistory.length, ...updatedSearchHistory);
}

export function clearStoredSearchHistory() {
  searchHistory.splice(0, searchHistory.length);
}
