import { useSession } from '@openmrs/esm-framework';
import { renderHook } from '@testing-library/react';
import useSWR from 'swr';
import {
  dateBounds,
  localDate,
  myAttentionsPrivileges,
  myAttentionsUrl,
  useMyAttentions,
} from './my-attentions.resource';

vi.mock('swr', () => ({ default: vi.fn(() => ({})) }));
const filters = { from: '2026-10-12', through: '2026-10-12', q: '', status: 'all' as const };

describe('my attentions query boundaries', () => {
  it('uses local midnight and an exclusive next-day end', () => {
    const bounds = dateBounds('2026-10-12', '2026-10-12');
    expect(bounds).toEqual({ from: new Date(2026, 9, 12).toISOString(), until: new Date(2026, 9, 13).toISOString() });
    expect(localDate(new Date(2026, 9, 12, 23, 59))).toBe('2026-10-12');
  });
  it.each([
    ['', '2026-10-12'],
    ['2026-02-30', '2026-03-02'],
    ['2026-10-13', '2026-10-12'],
    ['2024-01-01', '2026-01-01'],
  ])('rejects invalid dates %s through %s', (from, through) => expect(dateBounds(from, through)).toBeNull());
  it('encodes patient filters and pages without a caller-selected provider', () => {
    const url = new URL(myAttentionsUrl({ ...filters, q: 'Niño & niña' }, 2, 20) ?? '', 'http://localhost');
    expect(url.searchParams.get('q')).toBe('Niño & niña');
    expect(url.searchParams.get('startIndex')).toBe('20');
    expect(url.searchParams.has('provider')).toBe(false);
  });
  it.each([99, 100, 101])('validates the backend search boundary of %s UTF-16 units', (length) => {
    expect(Boolean(myAttentionsUrl({ ...filters, q: 'ñ'.repeat(length) }, 1, 20))).toBe(length <= 100);
  });
  it('includes exactly 366 days and rejects 367 days', () => {
    expect(dateBounds('2024-01-01', '2024-12-31')).not.toBeNull();
    expect(dateBounds('2024-01-01', '2025-01-01')).toBeNull();
  });
  it('does not fetch for an expired session or missing privileges', () => {
    vi.mocked(useSession).mockReturnValue({ authenticated: false } as ReturnType<typeof useSession>);
    renderHook(() => useMyAttentions(filters, 1, 20));
    expect(vi.mocked(useSWR).mock.lastCall?.[0]).toBeNull();
    vi.mocked(useSession).mockReturnValue({
      authenticated: true,
      user: { uuid: 'actor', privileges: [] },
    } as unknown as ReturnType<typeof useSession>);
    renderHook(() => useMyAttentions(filters, 1, 20));
    expect(vi.mocked(useSWR).mock.lastCall?.[0]).toBeNull();
  });
  it('separates response caches when the logged-in user changes', () => {
    const session = (uuid: string) =>
      ({
        authenticated: true,
        user: { uuid, privileges: myAttentionsPrivileges.map((display) => ({ display })) },
      }) as unknown as ReturnType<typeof useSession>;
    vi.mocked(useSession).mockReturnValue(session('doctor-a'));
    const { rerender } = renderHook(() => useMyAttentions(filters, 1, 20));
    expect(vi.mocked(useSWR).mock.lastCall?.[0]).toEqual([myAttentionsUrl(filters, 1, 20), 'doctor-a']);
    vi.mocked(useSession).mockReturnValue(session('doctor-b'));
    rerender();
    expect(vi.mocked(useSWR).mock.lastCall?.[0]).toEqual([myAttentionsUrl(filters, 1, 20), 'doctor-b']);
  });
});
