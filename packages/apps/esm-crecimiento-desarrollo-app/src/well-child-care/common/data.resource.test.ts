import { openmrsFetch } from '@openmrs/esm-framework';

import type { ConfigObject } from '../../config-schema';

import { saveVitalsAndBiometrics } from './data.resource';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  openmrsFetch: vi.fn(),
  restBaseUrl: '/ws/rest/v1',
}));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const concepts = {
  stoolCountUuid: 'concept-stool-count',
  urineCountUuid: 'concept-urine-count',
} as ConfigObject['concepts'];

describe('vitals and biometrics resource', () => {
  beforeEach(() => {
    mockOpenmrsFetch.mockReset();
    mockOpenmrsFetch.mockResolvedValueOnce({ status: 201 } as Awaited<ReturnType<typeof openmrsFetch>>);
  });

  it('keeps zero values when building encounter observations', async () => {
    await saveVitalsAndBiometrics(
      'encounter-type-uuid',
      'form-uuid',
      concepts,
      'patient-uuid',
      {
        stoolCount: 0,
        urineCount: 6,
      },
      new AbortController(),
      'location-uuid',
    );

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      '/ws/rest/v1/encounter',
      expect.objectContaining({
        body: expect.objectContaining({
          obs: [
            {
              concept: 'concept-stool-count',
              value: 0,
            },
            {
              concept: 'concept-urine-count',
              value: 6,
            },
          ],
        }),
      }),
    );
  });
});
