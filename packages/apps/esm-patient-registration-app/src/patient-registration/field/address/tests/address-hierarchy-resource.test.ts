import { openmrsFetch } from '@openmrs/esm-framework';

import { buildAddressHierarchyPath, fetchAddressHierarchyQuickSearch } from '../address-hierarchy.resource';

const mockOpenmrsFetch = openmrsFetch as vi.Mock;

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  openmrsFetch: vi.fn(),
}));

beforeEach(() => {
  mockOpenmrsFetch.mockReset();
});

describe('address hierarchy quick search', () => {
  it('builds a full address path from an entry and its parents', () => {
    expect(
      buildAddressHierarchyPath(
        {
          uuid: 'district-uuid',
          name: 'CHURCAMPA',
          parent: {
            uuid: 'province-uuid',
            name: 'CHURCAMPA',
            parent: {
              uuid: 'region-uuid',
              name: 'HUANCAVELICA',
              parent: {
                uuid: 'country-uuid',
                name: 'PERU',
              },
            },
          },
        },
        ' > ',
      ),
    ).toBe('PERU > HUANCAVELICA > CHURCAMPA > CHURCAMPA');
  });

  it('searches each configured hierarchy level and returns deduplicated shallow-first paths', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({
        data: [
          {
            uuid: 'country-uuid',
            name: 'PERU',
          },
        ],
      })
      .mockResolvedValueOnce({
        data: [
          {
            uuid: 'region-uuid',
            name: 'HUANCAVELICA',
            userGeneratedId: '09',
            parent: {
              uuid: 'country-uuid',
              name: 'PERU',
              userGeneratedId: '00',
            },
          },
          {
            uuid: 'region-uuid',
            name: 'HUANCAVELICA',
            userGeneratedId: '09',
            parent: {
              uuid: 'country-uuid',
              name: 'PERU',
              userGeneratedId: '00',
            },
          },
        ],
      });

    await expect(fetchAddressHierarchyQuickSearch('PER', ' > ', ['country', 'address1'])).resolves.toMatchObject([
      {
        display: 'PERU',
        fieldValues: {
          country: 'PERU',
        },
        userGeneratedId: undefined,
      },
      {
        display: 'PERU > HUANCAVELICA',
        fieldValues: {
          country: 'PERU',
          address1: 'HUANCAVELICA',
        },
        userGeneratedId: '09',
      },
    ]);

    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(
      1,
      '/module/addresshierarchy/ajax/getPossibleAddressHierarchyEntriesWithParents.form?addressField=country&limit=20&searchString=PER&parentUuid=',
    );
    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(
      2,
      '/module/addresshierarchy/ajax/getPossibleAddressHierarchyEntriesWithParents.form?addressField=address1&limit=20&searchString=PER&parentUuid=',
    );
  });

  it('searches by UBIGEO code using the parent generated id and stores the matching code in the result', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({
        data: [],
      })
      .mockResolvedValueOnce({
        data: [],
      })
      .mockResolvedValueOnce({
        data: [],
      })
      .mockResolvedValueOnce({
        data: [],
      })
      .mockResolvedValueOnce({
        data: [],
      })
      .mockResolvedValueOnce({
        data: [
          {
            uuid: 'wrong-center-uuid',
            name: '9 HERMANOS',
            userGeneratedId: '2502010190',
            parent: {
              uuid: 'district-uuid',
              name: 'RAYMONDI',
              userGeneratedId: '250201',
              parent: {
                uuid: 'province-uuid',
                name: 'ATALAYA',
                userGeneratedId: '2502',
                parent: {
                  uuid: 'region-uuid',
                  name: 'UCAYALI',
                  userGeneratedId: '25',
                  parent: {
                    uuid: 'country-uuid',
                    name: 'PERU',
                    userGeneratedId: '00',
                  },
                },
              },
            },
          },
          {
            uuid: 'center-uuid',
            name: 'AGUAJAL',
            userGeneratedId: '2502010191',
            parent: {
              uuid: 'district-uuid',
              name: 'RAYMONDI',
              userGeneratedId: '250201',
              parent: {
                uuid: 'province-uuid',
                name: 'ATALAYA',
                userGeneratedId: '2502',
                parent: {
                  uuid: 'region-uuid',
                  name: 'UCAYALI',
                  userGeneratedId: '25',
                  parent: {
                    uuid: 'country-uuid',
                    name: 'PERU',
                    userGeneratedId: '00',
                  },
                },
              },
            },
          },
        ],
      });

    await expect(
      fetchAddressHierarchyQuickSearch('AGUAJAL%2502010191', ' > ', [
        'country',
        'address1',
        'stateProvince',
        'countyDistrict',
        'cityVillage',
      ]),
    ).resolves.toMatchObject([
      {
        display: 'PERU > UCAYALI > ATALAYA > RAYMONDI > AGUAJAL',
        fieldValues: {
          country: 'PERU',
          address1: 'UCAYALI',
          stateProvince: 'ATALAYA',
          countyDistrict: 'RAYMONDI',
          cityVillage: 'AGUAJAL',
        },
        userGeneratedId: '2502010191',
      },
    ]);

    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(
      6,
      '/module/addresshierarchy/ajax/getPossibleAddressHierarchyEntriesWithParents.form?addressField=cityVillage&limit=1000&searchString=%25&parentUuid=&userGeneratedIdForParent=250201',
    );
  });

  it('fails fast when the backend response is not a list of address hierarchy entries', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        error: 'AuthorizationAdvice',
      },
    });

    await expect(fetchAddressHierarchyQuickSearch('PER', ' > ', ['country'])).rejects.toThrow(
      'Invalid address hierarchy response',
    );
  });
});
