import { openmrsFetch, useConfig, usePatient } from '@openmrs/esm-framework';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { SWRConfig } from 'swr';
import { configSchema } from '../config-schema';
import { useAnemiaScreening } from './useAnemiaScreening';
import { useNutritionalAssessment } from './useNutritionalAssessment';
import { useVitalNewBorn } from './useVitalNewBorn';

const values = new Map<string, number | { display: string }>([
  [configSchema.childNutrition._default.weightConceptUuid, 3.8],
  [configSchema.childNutrition._default.heightConceptUuid, 51],
  [configSchema.childNutrition._default.nutritionClassificationConceptUuid, { display: 'Synthetic classification' }],
  [configSchema.anemiaScreening.hemoglobinaConceptUuid._default, 13.2],
]);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useConfig).mockReturnValue({
    childNutrition: configSchema.childNutrition._default,
    anemiaScreening: { hemoglobinaConceptUuid: configSchema.anemiaScreening.hemoglobinaConceptUuid._default },
    concepts: { newbornVitalSignsConceptSetUuid: 'synthetic-vital-set' },
  });
  vi.mocked(usePatient).mockReturnValue({ patient: undefined } as ReturnType<typeof usePatient>);
  vi.mocked(openmrsFetch).mockImplementation(async (input) => {
    const url = new URL(String(input), 'http://localhost');
    if (url.pathname.endsWith('/concept/synthetic-vital-set')) {
      return {
        data: {
          setMembers: [
            { uuid: 'synthetic-weight', display: 'Weight' },
            { uuid: 'synthetic-height', display: 'Height' },
          ],
        },
      } as Awaited<ReturnType<typeof openmrsFetch>>;
    }
    const params = url.searchParams;
    // Reproduces the deployed REST fallback: an unsupported sort parameter
    // selects the patient-only resource search, losing the concept filter.
    if (params.has('sort') && params.get('s') !== 'default') {
      return { data: { results: [{ value: 3.8 }] } } as Awaited<ReturnType<typeof openmrsFetch>>;
    }
    if (params.get('concept')?.includes(',')) throw new Error('A single concept parameter cannot contain a list');
    const concepts = params.get('concepts')?.split(',') ?? [params.get('concept')];
    const results = concepts.map((concept, index) => ({
      uuid: `synthetic-obs-${index}`,
      concept: { uuid: concept, display: concept === 'synthetic-weight' ? 'Weight' : 'Height' },
      value: values.get(concept ?? '') ?? (concept === 'synthetic-weight' ? 3.8 : 51),
      obsDatetime: '2026-10-02T14:00:00Z',
    }));
    return { data: { results } } as Awaited<ReturnType<typeof openmrsFetch>>;
  });
});

const wrapper = ({ children }: PropsWithChildren) => (
  <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>{children}</SWRConfig>
);

it('keeps weight, height and nutritional classification distinct', async () => {
  const { result } = renderHook(() => useNutritionalAssessment('synthetic-child'), { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current).toMatchObject({
    weight: '3.8',
    height: '51',
    nutritionClassification: 'Synthetic classification',
    error: undefined,
  });
});

it('reads measured hemoglobin instead of an unrelated observation', async () => {
  const { result } = renderHook(() => useAnemiaScreening('synthetic-child'), { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.lastHb).toBe(13.2);
  expect(result.current.error).toBeNull();
});

it('loads every newborn vital concept through the multi-concept search', async () => {
  const { result } = renderHook(() => useVitalNewBorn('synthetic-child'), { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.error).toBeUndefined();
  expect(result.current.vitals.map(({ concept, value }) => ({ concept, value }))).toEqual([
    { concept: 'Weight', value: 3.8 },
    { concept: 'Height', value: 51 },
  ]);
});
