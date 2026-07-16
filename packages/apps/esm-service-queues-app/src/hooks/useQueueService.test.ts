import { renderHook } from '@testing-library/react';
import { mockQueueSurgery, mockQueueTriage, mockServiceSurgery, mockServiceTriage } from 'test-utils';

import { type Queue } from '../types';
import useQueueServices from './useQueueService';
import { useQueues } from './useQueues';

const mockUseQueues = vi.mocked(useQueues);

vi.mock('./useQueues', () => ({
  useQueues: vi.fn(),
}));

function mockQueueResult(queues: Array<Queue>, isLoading = false) {
  mockUseQueues.mockReturnValue({ queues, isLoading } as ReturnType<typeof useQueues>);
}

describe('useQueueServices', () => {
  beforeEach(() => {
    mockUseQueues.mockReset();
  });

  it('returns unique services sorted by display name', () => {
    mockQueueResult([mockQueueTriage, mockQueueSurgery, { ...mockQueueTriage, uuid: 'queue-with-duplicate-service' }]);

    const { result } = renderHook(() => useQueueServices());

    expect(result.current.services).toEqual([mockServiceSurgery, mockServiceTriage]);
  });

  it('ignores queues whose service is missing or incomplete', () => {
    const queueWithoutService = {
      ...mockQueueTriage,
      uuid: 'queue-without-service',
      service: undefined,
    } as unknown as Queue;
    const queueWithoutServiceDisplay = {
      ...mockQueueTriage,
      uuid: 'queue-without-service-display',
      service: { ...mockServiceTriage, display: '' },
    };
    mockQueueResult([queueWithoutService, queueWithoutServiceDisplay, mockQueueTriage]);

    const { result } = renderHook(() => useQueueServices());

    expect(result.current.services).toEqual([mockServiceTriage]);
  });

  it('returns an empty service list while queues are loading', () => {
    mockQueueResult([], true);

    const { result } = renderHook(() => useQueueServices());

    expect(result.current.services).toEqual([]);
    expect(result.current.isLoadingQueueServices).toBe(true);
  });
});
