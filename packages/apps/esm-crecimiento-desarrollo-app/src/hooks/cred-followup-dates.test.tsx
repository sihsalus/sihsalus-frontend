import { openmrsFetch, useConfig } from '@openmrs/esm-framework';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { SWRConfig } from 'swr';
import { configSchema } from '../config-schema';
import { useNutritionFollowup } from './useNutritionFollowup';
import { useNutritionalAssessment } from './useNutritionalAssessment';
import { useStimulationFollowup } from './useStimulationFollowup';

const nutrition = configSchema.childNutrition._default;
const stimulation = configSchema.earlyStimulation._default;
const observations = new Map<string, { value: string | number; obsDatetime: string }>([
  [nutrition.mmnReceivingConceptUuid, { value: 10, obsDatetime: '2026-01-01T12:00:00Z' }],
  [nutrition.ironReceivingConceptUuid, { value: 20, obsDatetime: '2026-03-03T12:00:00Z' }],
  [nutrition.nutritionCounselingConceptUuid, { value: 'Counseling', obsDatetime: '2026-02-02T12:00:00Z' }],
  [nutrition.nutritionClassificationConceptUuid, { value: 'Normal', obsDatetime: '2026-04-04T12:00:00Z' }],
  [nutrition.weightConceptUuid, { value: 8, obsDatetime: '2026-01-01T12:00:00Z' }],
  [nutrition.heightConceptUuid, { value: 70, obsDatetime: '2026-03-03T12:00:00Z' }],
  [stimulation.tepsiCoordinationConceptUuid, { value: 'Normal', obsDatetime: '2026-01-01T12:00:00Z' }],
  [stimulation.tepsiMotorConceptUuid, { value: 'Normal', obsDatetime: '2026-03-03T12:00:00Z' }],
  [stimulation.stimulationLackConceptUuid, { value: 'No risk', obsDatetime: '2026-02-02T12:00:00Z' }],
]);

const wrapper = ({ children }: PropsWithChildren) => (
  <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>{children}</SWRConfig>
);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useConfig).mockReturnValue({
    childNutrition: nutrition,
    earlyStimulation: stimulation,
  });
  vi.mocked(openmrsFetch).mockImplementation(async (input) => {
    const concept = new URL(String(input), 'http://localhost').searchParams.get('concept') ?? '';
    const observation = observations.get(concept);
    return {
      data: {
        results: observation ? [{ uuid: `synthetic-${concept}`, ...observation }] : [],
      },
    } as Awaited<ReturnType<typeof openmrsFetch>>;
  });
});

it('dates nutritional follow-up from the newest field, even when MMN is older', async () => {
  const { result } = renderHook(() => useNutritionFollowup('synthetic-child'), {
    wrapper,
  });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.lastFollowupDate).toBe('03/03/2026');
});

it('dates the last measurement from weight and height, not a later classification', async () => {
  const { result } = renderHook(() => useNutritionalAssessment('synthetic-child'), { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.lastMeasurementDate).toBe('03/03/2026');
});

it('dates historical stimulation from the newest assessment field', async () => {
  const { result } = renderHook(() => useStimulationFollowup('synthetic-child'), { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.lastEvaluationDate).toBe('03/03/2026');
});
