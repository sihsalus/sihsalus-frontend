import { renderHook } from '@testing-library/react';
import useSWR from 'swr';
import { useVisit } from './current-visit.resource';

vi.mock('swr', () => ({ default: vi.fn() }));

const mockUseSWR = vi.mocked(useSWR);

describe('useVisit clinical representation', () => {
  beforeEach(() => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as never);
  });

  it('requests encounter form identity for canonical Visit Notes filtering', () => {
    renderHook(() => useVisit('visit-uuid'));
    const key = mockUseSWR.mock.calls[0][0] as string;
    const representation = new URL(key, 'https://openmrs.test').searchParams.get('v');
    expect(representation).toContain('form:(uuid,display)');
    expect(representation).toContain('diagnoses:(uuid,display,certainty,rank,voided');
    expect(representation.match(/\(/g)).toHaveLength(representation.match(/\)/g).length);
  });

  it('does not request an unscoped visit without a UUID', () => {
    renderHook(() => useVisit());
    expect(mockUseSWR.mock.calls[0][0]).toBeNull();
  });
});
