import { fhirBaseUrl, openmrsFetch } from '@openmrs/esm-framework';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { SWRConfig } from 'swr';

import { useMappedPatientObservations } from './useMappedPatientObservations';

vi.mock('@openmrs/esm-framework', async () => {
  const actual = await vi.importActual<typeof import('@openmrs/esm-framework')>('@openmrs/esm-framework');
  return {
    ...actual,
    fhirBaseUrl: '/ws/fhir2/R4',
    openmrsFetch: vi.fn(),
  };
});

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const swrWrapper = ({ children }: PropsWithChildren) =>
  createElement(SWRConfig, { value: { dedupingInterval: 0, provider: () => new Map() } }, children);

describe('useMappedPatientObservations', () => {
  beforeEach(() => {
    mockOpenmrsFetch.mockReset();
  });

  it('groups observations by timestamp and preserves zero values', async () => {
    mockOpenmrsFetch.mockResolvedValue({
      data: {
        entry: [
          {
            resource: {
              code: { coding: [{ code: 'zero-concept' }] },
              effectiveDateTime: '2026-06-11T15:00:00.000Z',
              valueQuantity: { value: 0 },
            },
          },
          {
            resource: {
              code: { coding: [{ code: 'weight-concept' }] },
              effectiveDateTime: '2026-06-11T15:00:00.000Z',
              valueQuantity: { value: 62 },
            },
          },
        ],
        link: [],
        total: 2,
      },
    } as Awaited<ReturnType<typeof openmrsFetch>>);

    const { result } = renderHook(
      () =>
        useMappedPatientObservations({
          conceptUuids: ['zero-concept', 'weight-concept'],
          getObservationKey: (conceptUuid) =>
            ({
              'zero-concept': 'stoolCount',
              'weight-concept': 'weight',
            })[conceptUuid],
          patientUuid: 'patient-uuid',
        }),
      { wrapper: swrWrapper },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      expect.stringContaining(`${fhirBaseUrl}/Observation?subject:Patient=patient-uuid&`),
    );
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(expect.stringContaining('code=zero-concept%2Cweight-concept'));
    expect(result.current.data).toEqual([
      {
        id: '0',
        date: '2026-06-11T15:00:00.000Z',
        stoolCount: 0,
        weight: 62,
      },
    ]);
  });
});
