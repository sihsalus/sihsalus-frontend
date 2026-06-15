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
});
