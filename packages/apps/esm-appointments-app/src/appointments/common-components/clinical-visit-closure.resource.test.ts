import { openmrsFetch, restBaseUrl, toOmrsIsoString } from '@openmrs/esm-framework';

import { closeClinicalVisit } from './clinical-visit-closure.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

describe('closeClinicalVisit', () => {
  it('uses the least-privilege clinical visit closure endpoint', async () => {
    const abortController = new AbortController();
    const stopDatetime = new Date('2026-08-04T18:30:00.000Z');
    vi.mocked(toOmrsIsoString).mockReturnValue('2026-08-04T18:30:00.000+0000');
    mockOpenmrsFetch.mockResolvedValue({} as Awaited<ReturnType<typeof openmrsFetch>>);

    await closeClinicalVisit('visit-uuid', { stopDatetime }, abortController);

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${restBaseUrl}/clinicalvisitclosure`, {
      signal: abortController.signal,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        visitUuid: 'visit-uuid',
        stopDatetime: '2026-08-04T18:30:00.000+0000',
      },
    });
    expect(toOmrsIsoString).toHaveBeenCalledWith(stopDatetime);
  });
});
