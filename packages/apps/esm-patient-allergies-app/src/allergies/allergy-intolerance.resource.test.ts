import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import type { Mock } from 'vitest';
import { fetchAllergies } from './allergy-intolerance.resource';

const mockFetch = openmrsFetch as Mock;
const url = `${restBaseUrl}/patient/patient-1/allergy?v=full&limit=100&totalCount=true`;

function nextPageUrl(patientUuid = 'patient-1') {
  const next = new URL(url, window.location.href);
  next.pathname = next.pathname.replace('patient-1', patientUuid);
  next.host = 'internal-openmrs';
  next.searchParams.set('startIndex', '1');
  return next.toString();
}

describe('fetchAllergies', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('loads every REST page before returning allergies', async () => {
    mockFetch
      .mockResolvedValueOnce({
        data: {
          results: [{ uuid: 'allergy-1', display: 'Penicillin' }],
          links: [{ rel: 'next', uri: nextPageUrl() }],
          totalCount: 2,
        },
      })
      .mockResolvedValueOnce({ data: { results: [{ uuid: 'allergy-2', display: 'Peanut' }], totalCount: 2 } });

    await expect(fetchAllergies(url)).resolves.toEqual({
      data: { results: [{ uuid: 'allergy-1', display: 'Penicillin' }, { uuid: 'allergy-2', display: 'Peanut' }] },
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1][0]).toContain('startIndex=1');
    expect(mockFetch.mock.calls[1][0]).not.toContain('internal-openmrs');
  });

  it('rejects an incomplete response instead of showing a partial list', async () => {
    mockFetch.mockResolvedValueOnce({ data: { results: [{ uuid: 'allergy-1' }], totalCount: 2 } });

    await expect(fetchAllergies(url)).rejects.toThrow('incomplete');
  });

  it('rejects a pagination link to another patient', async () => {
    mockFetch.mockResolvedValueOnce({
      data: {
        results: [{ uuid: 'allergy-1' }],
        links: [{ rel: 'next', uri: nextPageUrl('patient-2') }],
      },
    });

    await expect(fetchAllergies(url)).rejects.toThrow('Invalid allergy pagination link');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does not present unknown allergy status as no known allergies', async () => {
    mockFetch.mockResolvedValueOnce({ status: 204, data: null });

    await expect(fetchAllergies(url)).rejects.toThrow('unknown');
  });
});
