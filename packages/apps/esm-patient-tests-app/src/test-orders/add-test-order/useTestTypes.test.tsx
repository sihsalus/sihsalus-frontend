import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { useOrderableConceptSets } from '@openmrs/esm-patient-common-lib';
import { renderHook } from '@testing-library/react';
import { type ConfigObject, configSchema } from '../../config-schema';
import { useTestTypes } from './useTestTypes';

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockUseOrderableConceptSets = vi.mocked(useOrderableConceptSets);

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  useOrderableConceptSets: vi.fn(),
}));

describe('useTestTypes', () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue(getDefaultsFromConfigSchema(configSchema) as ConfigObject);
    mockUseOrderableConceptSets.mockReturnValue({
      concepts: [
        {
          uuid: '4686f6f2-a42e-47c3-aa56-8301bd1c71b6',
          display: 'Alanina Transferasa',
          names: [{ display: 'ALT' }],
        },
      ],
      error: null,
      isLoading: false,
    } as ReturnType<typeof useOrderableConceptSets>);
  });

  it('finds an orderable test through a configured local alias pending its OCL publication', () => {
    const { result } = renderHook(() => useTestTypes('TGP', ['laboratory-set-uuid']));

    expect(result.current.testTypes).toEqual([
      expect.objectContaining({
        conceptUuid: '4686f6f2-a42e-47c3-aa56-8301bd1c71b6',
        label: 'Alanina Transferasa',
        synonyms: expect.arrayContaining(['ALT', 'TGP']),
      }),
    ]);
  });
});
