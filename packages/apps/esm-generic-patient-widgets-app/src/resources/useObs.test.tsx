// Adapted from OpenMRS patient-chart 54e48e8f97ee116b97829f2b9df66c699d27dd4d (MPL-2.0).
import { type FetchResponse, openmrsFetch, useConfig } from '@openmrs/esm-framework';
import { renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConfigObject } from '../config-schema';
import { useObs } from './useObs';

const concept = '5089AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const mockFetch = vi.mocked(openmrsFetch<fhir.Bundle>);
const mockConfig = vi.mocked(useConfig<ConfigObject>);

function createBundle(): fhir.Bundle {
  return {
    resourceType: 'Bundle',
    type: 'searchset',
    entry: [
      {
        resource: {
          resourceType: 'Observation',
          id: 'synthetic-with-encounter',
          status: 'final',
          code: { coding: [{ code: concept }] },
          valueQuantity: { value: 72 },
          encounter: { reference: 'Encounter/synthetic-encounter' },
        },
      },
      {
        resource: {
          resourceType: 'Observation',
          id: 'synthetic-without-encounter',
          status: 'final',
          code: { coding: [{ code: concept }] },
          valueQuantity: { value: 0 },
        },
      },
      {
        resource: {
          resourceType: 'Encounter',
          id: 'synthetic-encounter',
          status: 'finished',
          class: { code: 'AMB' },
          type: [{ coding: [{ code: 'synthetic-encounter-type', display: 'Synthetic encounter' }] }],
        },
      },
    ],
  };
}

function renderObservations(includeEncounters = true) {
  // A new cache for every test prevents a previous bundle from hiding a fetch or error.
  const cache = new Map();
  return renderHook(() => useObs('synthetic-patient', includeEncounters), {
    wrapper: ({ children }) => (
      <SWRConfig value={{ provider: () => cache, dedupingInterval: 0, shouldRetryOnError: false }}>
        {children}
      </SWRConfig>
    ),
  });
}

describe('useObs', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockConfig.mockReturnValue({
      encounterTypes: [],
      data: [{ concept, label: 'Weight', color: 'blue' }],
    } as ConfigObject);
  });

  it('maps observations without encounters, retains zero values and excludes encounter resources', async () => {
    const bundle = createBundle();
    mockFetch.mockResolvedValue({ data: bundle } as FetchResponse<fhir.Bundle>);
    const { result } = renderObservations();

    await waitFor(() => expect(result.current.data).toHaveLength(2));
    expect(result.current.data[0]).toMatchObject({
      conceptUuid: concept,
      dataType: 'Number',
      encounter: { reference: 'Encounter/synthetic-encounter', name: 'Synthetic encounter' },
    });
    expect(result.current.data[1].encounter).toBeUndefined();
    expect(result.current.data[1].valueQuantity.value).toBe(0);
    expect(result.current.concepts).toEqual([{ uuid: concept, display: 'Weight' }]);
    const url = new URL(String(mockFetch.mock.calls[0][0]), 'https://synthetic.invalid');
    expect(url.searchParams.get('_include')).toBe('Observation:encounter');
  });

  it('does not mutate the FHIR resources stored in the SWR cache', async () => {
    const bundle = createBundle();
    // Isolate cache mutation from the independent missing-encounter regression.
    bundle.entry.splice(1, 1);
    const original = structuredClone(bundle);
    mockFetch.mockResolvedValue({ data: bundle } as FetchResponse<fhir.Bundle>);
    const { result } = renderObservations();

    await waitFor(() => expect(result.current.data[0]?.encounter?.name).toBe('Synthetic encounter'));
    expect(bundle).toEqual(original);
  });

  it('uses the configured concept and encounter filter and requests linked encounters only when needed', async () => {
    mockConfig.mockReturnValue({
      encounterTypes: ['synthetic-type'],
      data: [{ concept, label: 'Weight', color: 'blue' }],
    } as ConfigObject);
    mockFetch.mockResolvedValue({
      data: { resourceType: 'Bundle', type: 'searchset', entry: [] },
    } as FetchResponse<fhir.Bundle>);
    const { result } = renderObservations(false);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const url = new URL(String(mockFetch.mock.calls[0][0]), 'https://synthetic.invalid');
    expect(url.searchParams.get('subject:Patient')).toBe('synthetic-patient');
    expect(url.searchParams.get('code')).toBe(concept);
    expect(url.searchParams.get('encounter.type')).toBe('synthetic-type');
    expect(url.searchParams.has('_include')).toBe(false);
    expect(result.current.data).toEqual([]);
  });

  it('exposes a fetch failure without inventing observations', async () => {
    const error = new Error('Synthetic fetch failure');
    mockFetch.mockRejectedValue(error);
    const { result } = renderObservations();
    await waitFor(() => expect(result.current.error).toBe(error));
    expect(result.current.data).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });
});
