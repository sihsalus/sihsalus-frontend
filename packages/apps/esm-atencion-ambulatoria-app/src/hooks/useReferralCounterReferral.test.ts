import { renderHook } from '@testing-library/react';
import { useMergedClinicalHistoryPagination } from './useClinicalHistoryPagination';
import { useReferralCounterReferral } from './useReferralCounterReferral';

vi.mock('./useClinicalHistoryPagination', () => ({
  useMergedClinicalHistoryPagination: vi.fn(),
  toEncounterTypeSources: (value: string | Array<string> | undefined | null) =>
    (Array.isArray(value) ? value : [value]).filter(Boolean).map((encounterTypeUuid) => ({ encounterTypeUuid })),
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

  it('maps structured referrals and consultation orders from one globally paginated history', () => {
    const onPageChange = vi.fn();
    const mutate = vi.fn();
    mockUseMergedClinicalHistoryPagination.mockReturnValue({
      data: [
        {
          uuid: 'referral-11',
          encounterDatetime: '2026-07-09T15:30:00.000Z',
          encounterType: { uuid: 'referral-encounter' },
          encounterProviders: [{ display: 'Dra. Perez - Clinician' }],
          obs: [{ concept: { uuid: 'referral-reason' }, value: 'Evaluación especializada' }],
        },
        {
          uuid: 'order-10',
          encounterDatetime: '2026-07-08T10:00:00.000Z',
          encounterType: { uuid: 'external-consultation' },
          encounterProviders: [{ display: 'Dr. Ramos - Clinician' }],
          obs: [{ concept: { uuid: 'referral-order' }, value: 'Cardiología' }],
        },
      ],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate,
      pagination: { currentPage: 2, totalPages: 3, onPageChange },
    });

    const { result } = renderHook(() =>
      useReferralCounterReferral('patient-uuid', 'referral-encounter', 'external-consultation', {
        referralReasonUuid: 'referral-reason',
        referralUuid: 'referral-order',
      }),
    );

    expect(result.current.entries).toEqual([
      expect.objectContaining({
        uuid: 'referral-11',
        referralReason: 'Evaluación especializada',
        source: 'referralCounterReferral',
      }),
      expect.objectContaining({
        uuid: 'order-10-interconsultation-order',
        interconsultationOrder: 'Cardiología',
        source: 'interconsultationOrder',
      }),
    ]);
    expect(result.current.pagination).toEqual({ currentPage: 2, totalPages: 3, onPageChange });
    expect(result.current.mutate).toBe(mutate);
  });

  it('reads current and compatibility CE-001 referral observations', () => {
    mockUseMergedClinicalHistoryPagination.mockReturnValue({
      data: [
        {
          uuid: 'current-ce001',
          encounterDatetime: '2026-07-09T15:30:00.000Z',
          encounterType: { uuid: 'external-consultation' },
          encounterProviders: [],
          obs: [
            {
              concept: { uuid: 'f0000205-0000-4000-8000-000000000205' },
              value: 'Neurología',
            },
          ],
        },
        {
          uuid: 'legacy-ce001',
          encounterDatetime: '2026-07-08T10:00:00.000Z',
          encounterType: { uuid: 'external-consultation' },
          encounterProviders: [],
          obs: [
            {
              concept: { uuid: '162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' },
              value: 'Endocrinología',
              formFieldPath: 'rfe-forms-referencia',
            },
          ],
        },
      ],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
      pagination: { currentPage: 1, totalPages: 1, onPageChange: vi.fn() },
    });

    const { result } = renderHook(() =>
      useReferralCounterReferral('patient-uuid', 'referral-encounter', 'external-consultation', {}),
    );

    expect(result.current.entries.map((entry) => entry.interconsultationOrder)).toEqual([
      'Neurología',
      'Endocrinología',
    ]);
  });
});
