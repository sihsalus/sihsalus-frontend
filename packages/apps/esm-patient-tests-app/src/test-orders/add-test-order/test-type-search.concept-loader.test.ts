import { logError, openmrsFetch } from '@openmrs/esm-framework';

import { fetchConfiguredLabsetLabels } from './test-type-search.component';

const mockLogError = vi.mocked(logError);
const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const requests = [
  { uuid: 'concept-a', url: '/concept/concept-a' },
  { uuid: 'concept-b', url: '/concept/concept-b' },
];

const concept = (uuid: string) => ({ uuid, display: `Set ${uuid}` });

describe('test type configured concept loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns every configured concept label when all responses are valid', async () => {
    mockOpenmrsFetch.mockImplementation(
      async (url) =>
        ({
          data: concept(String(url).split('/').at(-1) ?? ''),
        }) as never,
    );

    await expect(fetchConfiguredLabsetLabels(requests)).resolves.toEqual({
      failedUuids: [],
      labsets: [concept('concept-a'), concept('concept-b')],
    });
    expect(mockLogError).not.toHaveBeenCalled();
  });

  it('preserves valid labels and records the UUID whose request failed', async () => {
    mockOpenmrsFetch.mockImplementation(async (url) => {
      if (String(url).endsWith('concept-b')) {
        throw new Error('Request failed');
      }
      return { data: concept('concept-a') } as never;
    });

    await expect(fetchConfiguredLabsetLabels(requests)).resolves.toEqual({
      failedUuids: ['concept-b'],
      labsets: [concept('concept-a')],
    });
    expect(mockLogError).toHaveBeenCalledWith(expect.any(Error), expect.stringContaining('concept-b'));
  });

  it('reports all configured labels as failed when responses are rejected or mismatched', async () => {
    mockOpenmrsFetch.mockImplementation(async (url) => {
      if (String(url).endsWith('concept-a')) {
        return { data: concept('different-concept') } as never;
      }
      throw new Error('Request failed');
    });

    await expect(fetchConfiguredLabsetLabels(requests)).resolves.toEqual({
      failedUuids: ['concept-a', 'concept-b'],
      labsets: [],
    });
    expect(mockLogError).toHaveBeenCalledTimes(2);
  });
});
