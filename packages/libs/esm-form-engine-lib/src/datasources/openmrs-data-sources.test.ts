import { openmrsFetch } from '@openmrs/esm-framework/src/internal';
import { EncounterRoleDataSource } from './encounter-role-datasource';
import { ProviderDataSource } from './provider-datasource';

vi.mock('@openmrs/esm-framework/src/internal', () => ({
  openmrsFetch: vi.fn(),
  restBaseUrl: '/openmrs/ws/rest/v1',
}));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

describe('OpenMRS data sources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches a single provider item without crashing on edit mode resolution', async () => {
    mockOpenmrsFetch.mockResolvedValue({
      data: { uuid: 'provider-uuid', display: 'Dr. Example' },
    } as any);

    const dataSource = new ProviderDataSource();
    const result = await dataSource.fetchSingleItem('provider-uuid');

    expect(result).toEqual({ uuid: 'provider-uuid', display: 'Dr. Example' });
    expect(mockOpenmrsFetch).toHaveBeenCalledWith('/openmrs/ws/rest/v1/provider/provider-uuid?v=custom:(uuid,display)');
  });

  it('fetches a single encounter role item without crashing on edit mode resolution', async () => {
    mockOpenmrsFetch.mockResolvedValue({
      data: { uuid: 'role-uuid', display: 'Clinician', name: 'Clinician' },
    } as any);

    const dataSource = new EncounterRoleDataSource();
    const result = await dataSource.fetchSingleItem('role-uuid');

    expect(result).toEqual({ uuid: 'role-uuid', display: 'Clinician', name: 'Clinician' });
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      '/openmrs/ws/rest/v1/encounterrole/role-uuid?v=custom:(uuid,display,name)',
    );
  });

  it('suggests roles from a partial name across catalog pages instead of REST exact-name search', async () => {
    const firstRole = { uuid: 'nurse', display: 'Enfermera de Triaje' };
    const matchingRole = { uuid: 'doctor', display: 'Médico Responsable' };
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: { results: [firstRole], links: [{ rel: 'next' }] } } as any)
      .mockResolvedValueOnce({ data: { results: [matchingRole] } } as any);

    expect(await new EncounterRoleDataSource().fetchData(' médico ')).toEqual([matchingRole]);
    expect(mockOpenmrsFetch.mock.calls.map(([url]) => url)).toEqual([
      '/openmrs/ws/rest/v1/encounterrole?v=custom:(uuid,display,name)&startIndex=0',
      '/openmrs/ws/rest/v1/encounterrole?v=custom:(uuid,display,name)&startIndex=1',
    ]);
  });

  it('returns the active catalog when the search is empty', async () => {
    const role = { uuid: 'doctor', display: 'Médico Responsable' };
    mockOpenmrsFetch.mockResolvedValue({ data: { results: [role] } } as any);

    expect(await new EncounterRoleDataSource().fetchData('')).toEqual([role]);
  });

  it('rejects incomplete or repeated pages rather than returning misleading suggestions', async () => {
    const role = { uuid: 'doctor', display: 'Médico Responsable' };
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: { results: [role], links: [{ rel: 'next' }] } } as any)
      .mockResolvedValueOnce({ data: { results: [role], links: [{ rel: 'next' }] } } as any);

    await expect(new EncounterRoleDataSource().fetchData('médico')).rejects.toThrow(
      'Unable to load the encounter role catalog.',
    );
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
  });

  it('preserves a later-page failure instead of exposing only the first page', async () => {
    const error = new Error('catalog unavailable');
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: { results: [{ uuid: 'doctor', display: 'Médico' }], links: [{ rel: 'next' }] } } as any)
      .mockRejectedValueOnce(error);

    await expect(new EncounterRoleDataSource().fetchData('')).rejects.toBe(error);
  });
});
