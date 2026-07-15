import { renderHook } from '@testing-library/react';
import {
  mockQueueSurgery,
  mockQueueTriage,
  mockStatusInService,
  mockStatusWaiting,
  mockStatusWaitingForTransfer,
} from 'test-utils';

import type { Queue } from '../types';
import useQueueStatuses from './useQueueStatuses';
import { useQueues } from './useQueues';

const mockUseQueues = vi.mocked(useQueues);

vi.mock('./useQueues', () => ({
  useQueues: vi.fn(),
}));

describe('useQueueStatuses', () => {
  beforeEach(() => {
    mockUseQueues.mockReset();
  });

  it('returns unique queue statuses in their configured workflow order', () => {
    mockUseQueues.mockReturnValue({
      queues: [mockQueueTriage, mockQueueSurgery],
      isLoading: false,
    } as ReturnType<typeof useQueues>);

    const { result } = renderHook(() => useQueueStatuses());

    expect(result.current.statuses).toEqual([mockStatusWaiting, mockStatusInService, mockStatusWaitingForTransfer]);
  });

  it('ignores missing and incomplete statuses', () => {
    const malformedQueue = {
      ...mockQueueTriage,
      allowedStatuses: [undefined, { uuid: '', display: 'Missing UUID' }, { uuid: 'missing-display' }],
    } as unknown as Queue;
    const queueWithoutStatuses = {
      ...mockQueueSurgery,
      allowedStatuses: undefined,
    } as unknown as Queue;
    mockUseQueues.mockReturnValue({
      queues: [malformedQueue, queueWithoutStatuses, mockQueueTriage],
      isLoading: false,
    } as ReturnType<typeof useQueues>);

    const { result } = renderHook(() => useQueueStatuses());

    expect(result.current.statuses).toEqual([mockStatusWaiting, mockStatusInService]);
  });

  it('preserves the loading state from the queues request', () => {
    mockUseQueues.mockReturnValue({ queues: [], isLoading: true } as ReturnType<typeof useQueues>);

    const { result } = renderHook(() => useQueueStatuses());

    expect(result.current.statuses).toEqual([]);
    expect(result.current.isLoadingQueueStatuses).toBe(true);
  });

  it('preserves errors from the queues request', () => {
    const error = new Error('Unable to load queues');
    mockUseQueues.mockReturnValue({ queues: [], isLoading: false, error } as ReturnType<typeof useQueues>);

    const { result } = renderHook(() => useQueueStatuses());

    expect(result.current.queueStatusesError).toBe(error);
  });
});
