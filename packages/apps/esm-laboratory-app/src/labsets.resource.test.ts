import { openmrsFetch } from '@openmrs/esm-framework';
import { fetchConfiguredLabsets, type LabsetResponse } from './labsets.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const hemogram: LabsetResponse = {
  uuid: 'hemogram',
  display: 'Hemograma completo',
  setMembers: [],
};
const urinalysis: LabsetResponse = {
  uuid: 'urinalysis',
  display: 'Examen completo de orina',
  setMembers: [],
};

describe('fetchConfiguredLabsets', () => {
  beforeEach(() => {
    mockOpenmrsFetch.mockReset();
  });

  it('keeps valid lab sets when one configured concept no longer exists', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: hemogram } as Awaited<ReturnType<typeof openmrsFetch>>)
      .mockRejectedValueOnce({ response: { status: 404 } })
      .mockResolvedValueOnce({ data: urinalysis } as Awaited<ReturnType<typeof openmrsFetch>>);

    await expect(fetchConfiguredLabsets(['/hemogram', '/missing', '/urinalysis'])).resolves.toEqual([
      hemogram,
      urinalysis,
    ]);
  });

  it('does not hide backend or connectivity failures', async () => {
    const backendFailure = { response: { status: 503 } };
    mockOpenmrsFetch.mockResolvedValueOnce({ data: hemogram } as Awaited<ReturnType<typeof openmrsFetch>>);
    mockOpenmrsFetch.mockRejectedValueOnce(backendFailure);

    await expect(fetchConfiguredLabsets(['/hemogram', '/unavailable'])).rejects.toBe(backendFailure);
  });
});
