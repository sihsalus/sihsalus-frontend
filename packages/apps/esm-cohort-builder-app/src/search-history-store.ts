import type { Patient, Query, SearchHistoryItem } from './types';

type StoredSearchHistoryItem = Pick<SearchHistoryItem, 'description' | 'memberIds' | 'parameters'>;

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
}

export function replaceStoredSearchHistory(updatedSearchHistory: Array<StoredSearchHistoryItem>) {
  searchHistory.splice(0, searchHistory.length, ...updatedSearchHistory);
}

export function clearStoredSearchHistory() {
  searchHistory.splice(0, searchHistory.length);
}
