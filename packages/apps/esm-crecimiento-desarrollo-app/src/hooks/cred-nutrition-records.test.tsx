import { openmrsFetch, useConfig } from '@openmrs/esm-framework';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { SWRConfig } from 'swr';
import { configSchema } from '../config-schema';
import { useFeedingAssessment } from './useFeedingAssessment';
import { useNutritionFollowup } from './useNutritionFollowup';

const forms = configSchema.formsList._default;
const wrapper = ({ children }: PropsWithChildren) => (
  <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false, dedupingInterval: 0 }}>
    {children}
  </SWRConfig>
);
const observation = (concept: string, value: unknown, voided = false) => ({
  uuid: `obs-${concept}`,
  concept: { uuid: concept },
  value,
  voided,
});
const encounter = (
  uuid: string,
  form: string,
  date: string,
  obs: ReturnType<typeof observation>[],
  patient = 'child-a',
  voided = false,
) => ({
  uuid,
  form: { uuid: `form-${form}`, name: form },
  encounterDatetime: date,
  patient: { uuid: patient },
  voided,
  obs,
});
const feedingObs = [
  observation('f0000010-0000-4000-8000-000000000010', 'Synthetic practice'),
  observation('f0000011-0000-4000-8000-000000000011', 'Synthetic counseling'),
  observation('f0000003-0000-4000-8000-000000000003', 'Synthetic agreement'),
];
const followupObs = [
  observation('f0000009-0000-4000-8000-000000000009', { uuid: 'classification', display: 'Synthetic classification' }),
  observation('f0000002-0000-4000-8000-000000000002', 'Synthetic evolution'),
  observation('f0000005-0000-4000-8000-000000000005', { uuid: 'yes', display: 'Yes' }),
];
let firstPage: unknown[];
let secondPage: unknown[];

beforeEach(() => {
  vi.clearAllMocks();
  firstPage = [];
  secondPage = [];
  vi.mocked(useConfig).mockReturnValue({ formsList: forms, childNutrition: configSchema.childNutrition._default });
  vi.mocked(openmrsFetch).mockImplementation(async (input) => {
    const url = new URL(String(input), 'http://localhost');
    const page2 = url.searchParams.get('startIndex') === '1';
    const next = new URL(url);
    next.searchParams.set('startIndex', '1');
    return {
      data: {
        results: url.pathname.endsWith('/encounter') ? (page2 ? secondPage : firstPage) : [],
        links: !page2 && secondPage.length ? [{ rel: 'next', uri: next.toString() }] : [],
      },
    } as Awaited<ReturnType<typeof openmrsFetch>>;
  });
});

it('reads CRED-007 practice, counseling and agreements from its own latest encounter across pages', async () => {
  firstPage = [
    encounter('nutrition', forms.nutritionalAssessmentForm, '2026-10-10T12:00:00Z', [
      observation('f0000003-0000-4000-8000-000000000003', 'Other form plan'),
    ]),
    encounter('old', forms.feedingCounselingForm, '2026-10-01T12:00:00Z', [feedingObs[0]]),
  ];
  secondPage = [encounter('latest', forms.feedingCounselingForm, '2026-10-02T12:00:00Z', feedingObs)];
  const { result } = renderHook(() => useFeedingAssessment('child-a'), { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current).toMatchObject({
    feedingPractice: 'Synthetic practice',
    counseling: 'Synthetic counseling',
    caregiverAgreements: 'Synthetic agreement',
    lastAssessmentDate: '02/10/2026',
  });
});

it('reads CRED-008 recorded classification, evolution and referral without substituting supplementation or other episodes', async () => {
  firstPage = [
    encounter('followup', forms.nutritionFollowupForm, '2026-10-02T12:00:00Z', followupObs),
    encounter('assessment', forms.nutritionalAssessmentForm, '2026-10-10T12:00:00Z', [followupObs[0]]),
    encounter('voided', forms.nutritionFollowupForm, '2026-10-11T12:00:00Z', followupObs, 'child-a', true),
    encounter('wrong-patient', forms.nutritionFollowupForm, '2026-10-12T12:00:00Z', followupObs, 'child-b'),
  ];
  const { result } = renderHook(() => useNutritionFollowup('child-a'), { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current).toMatchObject({
    nutritionClassification: 'Synthetic classification',
    evolution: 'Synthetic evolution',
    referral: 'Yes',
    lastFollowupDate: '02/10/2026',
  });
});

it('does not borrow missing or voided fields from an older encounter', async () => {
  firstPage = [
    encounter('old', forms.feedingCounselingForm, '2026-10-01T12:00:00Z', feedingObs),
    encounter('latest', forms.feedingCounselingForm, '2026-10-02T12:00:00Z', [{ ...feedingObs[0], voided: true }]),
  ];
  const { result } = renderHook(() => useFeedingAssessment('child-a'), { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current).toMatchObject({
    feedingPractice: null,
    counseling: null,
    caregiverAgreements: null,
    lastAssessmentDate: '02/10/2026',
  });
});

it('reports read failures instead of an empty successful record', async () => {
  vi.mocked(openmrsFetch).mockRejectedValue(new Error('Synthetic read failure'));
  const { result } = renderHook(() => useNutritionFollowup('child-a'), { wrapper });
  await waitFor(() => expect(result.current.error?.message).toBe('Synthetic read failure'));
});

it('does not report a successful record when a later encounter page fails', async () => {
  firstPage = [encounter('own', forms.nutritionFollowupForm, '2026-10-02T12:00:00Z', followupObs)];
  secondPage = [encounter('later', forms.nutritionFollowupForm, '2026-10-03T12:00:00Z', followupObs)];
  const fetchPage = vi.mocked(openmrsFetch).getMockImplementation();
  vi.mocked(openmrsFetch).mockImplementation((input, options) => {
    if (String(input).includes('startIndex=1')) return Promise.reject(new Error('Synthetic next page failure'));
    return fetchPage(input, options);
  });
  const { result } = renderHook(() => useNutritionFollowup('child-a'), { wrapper });
  await waitFor(() => expect(result.current.error?.message).toBe('Synthetic next page failure'));
});

it('preserves an empty successful read without inventing a record or breastfeeding status', async () => {
  const { result } = renderHook(() => useFeedingAssessment('child-a'), { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current).toMatchObject({
    feedingPractice: null,
    counseling: null,
    caregiverAgreements: null,
    lastAssessmentDate: null,
  });
  expect(result.current.error).toBeUndefined();
});

it('clears the preceding patient record during a patient switch', async () => {
  firstPage = [encounter('own', forms.feedingCounselingForm, '2026-10-02T12:00:00Z', feedingObs)];
  const { result, rerender } = renderHook(({ patient }) => useFeedingAssessment(patient), {
    wrapper,
    initialProps: { patient: 'child-a' },
  });
  await waitFor(() =>
    expect(result.current).toMatchObject({ isLoading: false, feedingPractice: 'Synthetic practice' }),
  );
  firstPage = [];
  rerender({ patient: 'child-b' });
  expect(result.current.feedingPractice).toBeNull();
  await waitFor(() =>
    expect(result.current).toMatchObject({ isLoading: false, feedingPractice: null, lastAssessmentDate: null }),
  );
});
