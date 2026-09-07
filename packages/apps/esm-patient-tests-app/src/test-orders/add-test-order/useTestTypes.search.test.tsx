import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { useOrderableConceptSets } from '@openmrs/esm-patient-common-lib';
import { renderHook } from '@testing-library/react';
import { type ConfigObject, configSchema } from '../../config-schema';
import { useTestTypes } from './useTestTypes';

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  useOrderableConceptSets: vi.fn(),
}));

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockUseOrderableConceptSets = vi.mocked(useOrderableConceptSets);

beforeEach(() => {
  mockUseConfig.mockReturnValue(getDefaultsFromConfigSchema(configSchema) as ConfigObject);
  mockUseOrderableConceptSets.mockReturnValue({
    concepts: [
      {
        uuid: 'synthetic-hematocrit',
        display: 'Hematocrit',
        names: [{ display: 'Prueba de hematocrito' }],
      },
    ],
    isLoading: false,
    error: null,
  } as ReturnType<typeof useOrderableConceptSets>);
});

it('searches imported concept synonyms with normalized, reordered partial terms', () => {
  const { result, rerender } = renderHook(({ query }) => useTestTypes(query, ['synthetic-lab-set']), {
    initialProps: { query: '  hematocrito   PRUEBA ' },
  });
  expect(result.current.testTypes[0]).toEqual(
    expect.objectContaining({
      conceptUuid: 'synthetic-hematocrit',
      matchedName: 'Prueba de hematocrito',
    }),
  );
  rerender({ query: 'hematocrtio' });
  expect(result.current.testTypes[0].approximateMatch).toBe(true);
  expect(mockUseOrderableConceptSets).toHaveBeenCalledWith('', ['synthetic-lab-set']);
});

it.each([
  { isLoading: true, error: null },
  { isLoading: false, error: new Error('synthetic failure') },
])('returns no selectable suggestions while loading or errored: %s', (state) => {
  mockUseOrderableConceptSets.mockReturnValue({ concepts: [], ...state });
  const { result } = renderHook(() => useTestTypes('hematocrito', ['synthetic-lab-set']));
  expect(result.current.testTypes).toEqual([]);
  expect(result.current.isLoading).toBe(state.isLoading);
  expect(result.current.error).toBe(state.error);
});
