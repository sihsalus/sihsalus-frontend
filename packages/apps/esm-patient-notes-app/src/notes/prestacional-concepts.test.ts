import { openmrsFetch } from '@openmrs/esm-framework';
import { fetchPrestacionalConceptsByName } from './visit-notes.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

describe('fetchPrestacionalConceptsByName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve solo miembros del concept-set Codigos Prestacionales que coinciden con la busqueda', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        results: [
          {
            uuid: 'catalog',
            display: 'Codigos Prestacionales',
            setMembers: [
              {
                uuid: 'prestacional-002',
                display: '002 - Control ambulatorio',
              },
              {
                uuid: 'prestacional-001',
                display: '001 - Consulta externa',
              },
              {
                uuid: 'prestacional-003',
                display: '003 - Procedimiento',
              },
            ],
          },
          { uuid: 'other-set', display: 'Otro catalogo', setMembers: [{ uuid: 'other-001', display: 'Consulta extra' }] },
        ],
      },
    } as Awaited<ReturnType<typeof openmrsFetch>>);

    await expect(fetchPrestacionalConceptsByName('consulta', 'Codigos Prestacionales')).resolves.toEqual([
      {
        uuid: 'prestacional-001',
        display: '001 - Consulta externa',
      },
    ]);
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      expect.stringContaining('/concept?q=Codigos%20Prestacionales&searchType=fuzzy'),
    );
  });
});
