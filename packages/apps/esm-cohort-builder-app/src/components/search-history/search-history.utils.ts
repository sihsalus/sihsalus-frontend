import { type SearchHistoryItem } from '../../types';

export const getSearchHistory = () => {
  const history = JSON.parse(window.sessionStorage.getItem('openmrsHistory'));
  const searchHistory: SearchHistoryItem[] = [];
  history?.map((historyItem, index) =>
    searchHistory.push({
      ...historyItem,
      id: (index + 1).toString(),
      patients: [],
      results: (historyItem.memberIds?.length ?? 0).toString(),
    }),
  );
  return searchHistory;
};
