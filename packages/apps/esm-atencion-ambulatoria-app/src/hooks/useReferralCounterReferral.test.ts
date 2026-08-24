import { renderHook } from '@testing-library/react';
import { useMergedClinicalHistoryPagination } from './useClinicalHistoryPagination';
import { useReferralCounterReferral } from './useReferralCounterReferral';

vi.mock('./useClinicalHistoryPagination', () => ({
  useMergedClinicalHistoryPagination: vi.fn(),
}));

interface EncounterFixture {
  uuid: string;
  encounterDatetime: string;
  encounterType: { uuid: string };
  encounterProviders: Array<{ display: string }>;
  obs: Array<{
    concept: { uuid: string };
    value: string;
    formFieldPath?: string;
  }>;
}

const mockUseMergedClinicalHistoryPagination = vi.mocked(useMergedClinicalHistoryPagination<EncounterFixture>);

describe('useReferralCounterReferral', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queries and maps only referral/counter-referral encounters', () => {
    const onPageChange = vi.fn();
    const mutate = vi.fn();
    const referralEncounter: EncounterFixture = {
      uuid: 'referral-11',
      encounterDatetime: '2026-07-09T15:30:00.000Z',
      encounterType: { uuid: 'referral-encounter' },
      encounterProviders: [{ display: 'Dra. Perez - Clinician' }],
      obs: [{ concept: { uuid: 'referral-reason' }, value: 'Evaluación especializada' }],
    };
    const externalConsultationEncounter: EncounterFixture = {
      uuid: 'external-consultation-10',
      encounterDatetime: '2026-07-08T10:00:00.000Z',
      encounterType: { uuid: 'external-consultation' },
      encounterProviders: [{ display: 'Dr. Ramos - Clinician' }],
      obs: [{ concept: { uuid: 'referral-order' }, value: 'Cardiología' }],
    };
    mockUseMergedClinicalHistoryPagination.mockReturnValue({
      data: [referralEncounter],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate,
      pagination: { currentPage: 2, totalPages: 3, onPageChange },
      sourceErrors: [],
      truncated: false,
    });

    const { result } = renderHook(() =>
      useReferralCounterReferral('patient-uuid', 'referral-encounter', {
        referralReasonUuid: 'referral-reason',
      }),
    );

    expect(result.current.entries).toEqual([
      expect.objectContaining({
        uuid: 'referral-11',
        referralReason: 'Evaluación especializada',
      }),
    ]);
    expect(result.current.pagination).toEqual({ currentPage: 2, totalPages: 3, onPageChange });
    expect(result.current.mutate).toBe(mutate);

    const [sources, isRelevant] = mockUseMergedClinicalHistoryPagination.mock.calls[0];
    expect(sources).toHaveLength(1);
    expect(sources?.[0]?.url).toContain('encounterType=referral-encounter');
    expect(sources?.[0]?.url).not.toContain('external-consultation');
    expect(isRelevant?.(referralEncounter)).toBe(true);
    expect(isRelevant?.(externalConsultationEncounter)).toBe(false);
  });

  it('does not interpret referral-like observations from external consultations as referrals', () => {
    mockUseMergedClinicalHistoryPagination.mockReturnValue({
      data: [
        {
          uuid: 'external-consultation-10',
          encounterDatetime: '2026-07-09T15:30:00.000Z',
          encounterType: { uuid: 'external-consultation' },
          encounterProviders: [],
          obs: [{ concept: { uuid: 'f0000205-0000-4000-8000-000000000205' }, value: 'Neurología' }],
        },
      ],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
      pagination: { currentPage: 1, totalPages: 1, onPageChange: vi.fn() },
      sourceErrors: [],
      truncated: false,
    });

    const { result } = renderHook(() =>
      useReferralCounterReferral('patient-uuid', 'referral-encounter', {}),
    );

    expect(result.current.entries).toEqual([]);
  });
});
