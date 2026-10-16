import { openmrsFetch } from '@openmrs/esm-framework';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { SWRConfig } from 'swr';
import { getQueueEntryDateCriteria } from '../store/queue-entry-date';
import { useAverageWaitTime } from './metrics.resource';

it('requests the native average for the service and entry day, and requeries after clearing the date', async () => {
  vi.mocked(openmrsFetch).mockReset();
  vi.mocked(openmrsFetch).mockResolvedValue({ data: { averageWaitTime: 12 } } as never);
  const cache = new Map();
  const wrapper = ({ children }: PropsWithChildren) => (
    <SWRConfig value={{ provider: () => cache }}>{children}</SWRConfig>
  );
  const { result, rerender } = renderHook(
    ({ date }: { date: string | null }) =>
      useAverageWaitTime('synthetic-service', 'synthetic-status', {
        ...getQueueEntryDateCriteria(date),
      }),
    { initialProps: { date: '2026-10-11' as string | null }, wrapper },
  );
  await waitFor(() => expect(result.current.waitTime?.averageWaitTime).toBe(12));
  const query = new URL(String(vi.mocked(openmrsFetch).mock.calls.at(-1)[0]), 'http://localhost').searchParams;
  expect(query.get('service')).toBe('synthetic-service');
  expect(query.has('queue')).toBe(false);
  expect(query.has('location')).toBe(false);
  expect(query.get('metric')).toBe('averageWaitTime');
  expect(query.get('startedOnOrAfter')).toBe(getQueueEntryDateCriteria('2026-10-11').startedOnOrAfter);
  expect(query.get('startedOnOrBefore')).toBe(getQueueEntryDateCriteria('2026-10-11').startedOnOrBefore);
  rerender({ date: null });
  await waitFor(() => expect(vi.mocked(openmrsFetch).mock.calls).toHaveLength(2));
  expect(String(vi.mocked(openmrsFetch).mock.calls.at(-1)[0])).not.toContain('startedOn');
});

it('queries all queues when no service is selected instead of treating a missing filter as zero', async () => {
  vi.mocked(openmrsFetch)
    .mockReset()
    .mockResolvedValue({ data: { averageWaitTime: null } } as never);
  const cache = new Map();
  const wrapper = ({ children }: PropsWithChildren) => (
    <SWRConfig value={{ provider: () => cache }}>{children}</SWRConfig>
  );
  const { result } = renderHook(() => useAverageWaitTime(null, 'synthetic-status'), { wrapper });
  await waitFor(() => expect(result.current.waitTime).toEqual({ averageWaitTime: null }));
  const query = new URL(String(vi.mocked(openmrsFetch).mock.calls[0][0]), 'http://localhost').searchParams;
  expect(query.has('service')).toBe(false);
  expect(query.has('queue')).toBe(false);
  expect(query.has('location')).toBe(false);
});
