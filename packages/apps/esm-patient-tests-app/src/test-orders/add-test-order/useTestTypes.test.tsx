import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { useOrderableConceptSets } from '@openmrs/esm-patient-common-lib';
import { renderHook } from '@testing-library/react';
import { type ConfigObject, configSchema } from '../../config-schema';
import { useTestTypes } from './useTestTypes';

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockUseOrderableConceptSets = vi.mocked(useOrderableConceptSets);

const ifccConcepts = [
  {
    uuid: 'f537c6d3-7fdd-45e1-896d-2a5da35e28bd',
    display: 'Alanina Aminotransferasa - Método IFCC sin piridoxal fosfato',
    names: [{ display: 'ALT IFCC sin P-5-P' }],
  },
  {
    uuid: '354230bd-e709-4c1c-bc6e-81e43f71d59d',
    display: 'Alanina Aminotransferasa - Método IFCC con piridoxal fosfato',
    names: [{ display: 'ALT IFCC con P-5-P' }],
  },
];

function mockConcepts(concepts: typeof ifccConcepts) {
  mockUseOrderableConceptSets.mockReturnValue({ concepts, error: null, isLoading: false } as ReturnType<
    typeof useOrderableConceptSets
  >);
}

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

  it.each(ifccConcepts)('finds the configured IFCC variant $uuid through TGP without renaming it', (concept) => {
    mockConcepts([concept]);

    const { result } = renderHook(() => useTestTypes('tgp', ['laboratory-set-uuid']));

    expect(result.current.testTypes).toEqual([
      expect.objectContaining({
        conceptUuid: concept.uuid,
        label: concept.display,
        synonyms: expect.arrayContaining([concept.names[0].display, 'TGP']),
      }),
    ]);
  });

  it('keeps the two IFCC variants as distinct choices', () => {
    mockConcepts(ifccConcepts);
    const { result } = renderHook(() => useTestTypes('TGP', ['laboratory-set-uuid']));

    expect(result.current.testTypes).toHaveLength(2);
    expect(result.current.testTypes.map(({ conceptUuid }) => conceptUuid).sort()).toEqual(
      ifccConcepts.map(({ uuid }) => uuid).sort(),
    );
  });

  it('does not create orderable choices for aliases missing from the loaded concept sets', () => {
    mockConcepts([]);
    const { result } = renderHook(() => useTestTypes('TGP', ['laboratory-set-uuid']));
    expect(result.current.testTypes).toEqual([]);
  });

  it('respects disabled local aliases while preserving the backend concept names', () => {
    mockConcepts(ifccConcepts);
    mockUseConfig.mockReturnValue({
      ...(getDefaultsFromConfigSchema(configSchema) as ConfigObject),
      testTypeSearchAliases: {},
    });
    const { result, rerender } = renderHook(({ term }) => useTestTypes(term, ['laboratory-set-uuid']), {
      initialProps: { term: 'TGP' },
    });
    expect(result.current.testTypes).toEqual([]);
    rerender({ term: 'ALT IFCC sin P-5-P' });
    expect(result.current.testTypes.map(({ conceptUuid }) => conceptUuid)).toEqual([ifccConcepts[0].uuid]);
  });
});
