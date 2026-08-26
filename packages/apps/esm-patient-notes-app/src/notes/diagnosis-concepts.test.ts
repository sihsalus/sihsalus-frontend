import { openmrsFetch } from '@openmrs/esm-framework';
import { fetchDiagnosisConceptsByName } from './visit-notes.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

describe('fetchDiagnosisConceptsByName', () => {
  it('requests the concept mappings that carry the CIE-10 code', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        results: [
          {
            uuid: 'diagnosis-e119',
            display: 'Diabetes mellitus tipo II',
            conceptMappings: [
              {
                conceptReferenceTerm: {
                  code: 'E11.9',
                  conceptSource: { name: 'ICD-10-WHO' },
                },
              },
            ],
          },
        ],
      },
    } as Awaited<ReturnType<typeof openmrsFetch>>);

    await expect(fetchDiagnosisConceptsByName('diabetes', 'diagnosis-class-uuid')).resolves.toEqual([
      expect.objectContaining({ uuid: 'diagnosis-e119' }),
    ]);
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      expect.stringContaining('conceptMappings:(conceptReferenceTerm:(conceptSource:(name),code))'),
    );
  });
});
