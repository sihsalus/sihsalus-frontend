import { act, renderHook } from '@testing-library/react';
import { useClinicalHistoryPagination } from './useClinicalHistoryPagination';
import { useReferralCounterReferral } from './useReferralCounterReferral';

vi.mock('./useClinicalHistoryPagination', () => ({
  useClinicalHistoryPagination: vi.fn(),
}));

interface EncounterFixture {
  uuid: string;
  encounterDatetime: string;
  encounterProviders: Array<{ display: string }>;
  obs: Array<{
    concept: { uuid: string };
    value: string;
  }>;
}

const mockUseClinicalHistoryPagination = vi.mocked(useClinicalHistoryPagination<EncounterFixture>);

describe('useReferralCounterReferral', () => {
  it('keeps paginating the source that still has results without repeating an exhausted source', () => {
    const goToReferralPage = vi.fn();
    const goToOrderPage = vi.fn();

    mockUseClinicalHistoryPagination
      .mockReturnValueOnce({
        data: [
          {
            uuid: 'referral-11',
            encounterDatetime: '2026-07-09T15:30:00.000Z',
            encounterProviders: [{ display: 'Dra. Perez - Clinician' }],
            obs: [{ concept: { uuid: 'referral-reason' }, value: 'Evaluación especializada' }],
          },
        ],
        error: undefined,
        isLoading: false,
        isValidating: false,
        mutate: vi.fn(),
        pagination: { currentPage: 2, totalPages: 3, onPageChange: goToReferralPage },
      })
      .mockReturnValueOnce({
        data: [
          {
            uuid: 'old-order',
            encounterDatetime: '2026-07-08T10:00:00.000Z',
            encounterProviders: [{ display: 'Dr. Ramos - Clinician' }],
            obs: [{ concept: { uuid: 'referral-order' }, value: 'Cardiología' }],
          },
        ],
        error: undefined,
        isLoading: false,
        isValidating: false,
        mutate: vi.fn(),
        pagination: { currentPage: 1, totalPages: 1, onPageChange: goToOrderPage },
      });

    const { result } = renderHook(() =>
      useReferralCounterReferral('patient-uuid', 'referral-encounter', 'external-consultation', {
        referralReasonUuid: 'referral-reason',
        referralUuid: 'referral-order',
      }),
    );

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0]).toMatchObject({
      uuid: 'referral-11',
      referralReason: 'Evaluación especializada',
      source: 'referralCounterReferral',
    });
    expect(result.current.pagination).toMatchObject({ currentPage: 2, totalPages: 3 });

    act(() => result.current.pagination.onPageChange(3));

    expect(goToReferralPage).toHaveBeenCalledWith(3);
    expect(goToOrderPage).not.toHaveBeenCalled();
  });
});
