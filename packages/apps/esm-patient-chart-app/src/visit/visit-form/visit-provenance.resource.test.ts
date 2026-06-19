import {
  buildAddressHierarchyPath,
  normalizeVisitProvenance,
  sanitizeVisitProvenance,
} from './visit-provenance.resource';

describe('visit provenance helpers', () => {
  it('keeps letters, spaces and commas while stripping numbers and symbols', () => {
    expect(sanitizeVisitProvenance('MAYNAS123, PERÚ@@@, SAN  JUAN//##')).toBe('MAYNAS, PERÚ, SAN JUAN');
  });

  it('normalizes comma-separated provenance segments before saving', () => {
    expect(normalizeVisitProvenance('  MAYNAS ,,  LORETO,   PERU  ')).toBe('MAYNAS, LORETO, PERU');
  });

  it('builds a readable address hierarchy path from parent entries', () => {
    expect(
      buildAddressHierarchyPath(
        {
          name: 'MAYNAS',
          parent: {
            name: 'LORETO',
            parent: {
              name: 'PERU',
            },
          },
        },
        ', ',
      ),
    ).toBe('PERU, LORETO, MAYNAS');
  });
});
