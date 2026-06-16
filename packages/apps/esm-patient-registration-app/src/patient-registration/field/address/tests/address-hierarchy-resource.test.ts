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
            parent: {
              uuid: 'country-uuid',
              name: 'PERU',
            },
          },
          {
            uuid: 'region-uuid',
            name: 'HUANCAVELICA',
            parent: {
              uuid: 'country-uuid',
              name: 'PERU',
            },
          },
        ],
      });

    await expect(fetchAddressHierarchyQuickSearch('PER', ' > ', ['country', 'address1'])).resolves.toEqual([
      'PERU',
      'PERU > HUANCAVELICA',
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
