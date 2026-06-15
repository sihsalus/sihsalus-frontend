import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { renderHook } from '@testing-library/react';
import useSWR from 'swr';
import { describe, expect, it, vi } from 'vitest';
import { useEthnicIdentity } from './useEthnicIdentity';
import { usePatientAttributes } from './usePatientAttributes';

vi.mock('swr', () => ({
  default: vi.fn(),
}));

vi.mock('./usePatientAttributes', () => ({
  usePatientAttributes: vi.fn(),
}));

const mockUsePatientAttributes = vi.mocked(usePatientAttributes);
const mockUseSWR = vi.mocked(useSWR);

describe('useEthnicIdentity', () => {
  beforeEach(() => {
    mockUsePatientAttributes.mockReturnValue({
      attributes: [],
      identifiers: [],
      isLoading: false,
      person: null,
      error: undefined,
    });
    mockUseSWR.mockReturnValue({
      data: null,
      error: undefined,
      isLoading: false,
      mutate: vi.fn(),
      isValidating: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns ethnicity from the configured person attribute type', () => {
    mockUsePatientAttributes.mockReturnValue({
      attributes: [
        {
          attributeType: { uuid: 'ethnicity-attribute-type-uuid', display: 'Etnia' },
          display: 'Etnia = Ashaninka',
          uuid: 'attribute-uuid',
          value: { display: 'Ashaninka' },
        },
      ],
      identifiers: [],
      isLoading: false,
      person: null,
      error: undefined,
    });

    const { result } = renderHook(() =>
      useEthnicIdentity('patient-uuid', 'ethnicity-concept-uuid', 'ethnicity-attribute-type-uuid'),
    );

    expect(result.current.currentValue).toBe('Ashaninka');
    expect(mockUsePatientAttributes).toHaveBeenCalledWith('patient-uuid');
  });

  it('falls back to the configured obs concept when no ethnicity attribute exists', () => {
    mockUseSWR.mockReturnValue({
      data: {
        data: {
          results: [
            {
              obsDatetime: '2026-06-09T00:00:00.000Z',
              uuid: 'obs-uuid',
              value: { display: 'Quechua' },
            },
          ],
        },
      },
      error: undefined,
      isLoading: false,
      mutate: vi.fn(),
      isValidating: false,
    });

    const { result } = renderHook(() =>
      useEthnicIdentity('patient-uuid', 'ethnicity-concept-uuid', 'ethnicity-attribute-type-uuid'),
    );

    expect(result.current.currentValue).toBe('Quechua');
    expect(mockUseSWR).toHaveBeenCalledWith(
      `${restBaseUrl}/obs?patient=patient-uuid&concept=ethnicity-concept-uuid&v=custom:(uuid,obsDatetime,value)&limit=1`,
      openmrsFetch,
    );
  });
});
