import type { OpenMRSPaginatedResponse } from './useOpenmrsPagination';

// Returns a sequentially increasing int array of the specified length.
export function getIntArray(start: number, length: number) {
  return new Array(length).fill(0).map((_, i) => start + i);
}

// Mocks the return value of a server-side paginated API.
export async function getTestData(url: string, totalCount: number): Promise<OpenMRSPaginatedResponse<number>> {
  const urlUrl = new URL(url, window.location.toString());
  const limit = Number.parseInt(urlUrl.searchParams.get('limit') ?? '50', 10);
  const startIndex = Number.parseInt(urlUrl.searchParams.get('startIndex') ?? '0', 10);

  const length = Math.max(0, Math.min(totalCount - startIndex, limit));
  const results = new Array(length).fill(0).map((_, i) => i + startIndex);
  const hasNext = startIndex + limit < totalCount;
  if (hasNext) {
    urlUrl.searchParams.set('startIndex', `${startIndex + limit}`);
  }
  const links = hasNext ? [{ rel: 'next', uri: urlUrl.toString() }] : [];
  return { results, links, totalCount } as OpenMRSPaginatedResponse<number>;
}
