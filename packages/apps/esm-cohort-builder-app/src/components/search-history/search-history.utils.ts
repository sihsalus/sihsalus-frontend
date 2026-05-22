import { getStoredSearchHistory } from '../../search-history-store';
import { type SearchHistoryItem } from '../../types';

export const getSearchHistory = () => {
  const searchHistory: SearchHistoryItem[] = [];
  getStoredSearchHistory().map((historyItem, index) =>
    searchHistory.push({
      ...historyItem,
      id: (index + 1).toString(),
    }),
  );
  return searchHistory;
};
