import {
  getIndicadorById,
  listIndicadores,
  listResultados,
  resolveOrdenesMock,
  searchEncounterTypesMock,
} from './indicators-data';

describe('searchEncounterTypesMock', () => {
  it('filters the full list by display name client-side', () => {
    const result = searchEncounterTypesMock('CRED');

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((item) => item.display.toLowerCase().includes('cred'))).toBe(true);
  });

  it('is case-insensitive and trims the query', () => {
    const result = searchEncounterTypesMock('  cred neonato ');

    expect(result).toHaveLength(1);
    expect(result[0].display).toBe('CRED Neonato');
  });

  it('returns the full list for an empty query', () => {
    const result = searchEncounterTypesMock('');

    expect(result.length).toBeGreaterThan(1);
  });
});

describe('resolveOrdenesMock', () => {
  it('returns correct Record for known UUIDs', () => {
    const result = resolveOrdenesMock(['ord-hemograma', 'ord-ferritina', 'ord-fluor']);

    expect(result).toEqual({
      'ord-hemograma': 'Hemograma',
      'ord-ferritina': 'Ferritina sérica',
      'ord-fluor': 'Aplicación de flúor',
    });
  });

  it('returns empty Record for empty input', () => {
    const result = resolveOrdenesMock([]);

    expect(result).toEqual({});
  });

  it('excludes unknown UUIDs from result (partial resolution)', () => {
    const result = resolveOrdenesMock(['ord-hemograma', 'ord-unknown', 'ord-fluor']);

    expect(result).toEqual({
      'ord-hemograma': 'Hemograma',
      'ord-fluor': 'Aplicación de flúor',
    });
    expect(result['ord-unknown']).toBeUndefined();
  });
});

describe('indicator demo data contracts', () => {
  it('keeps every mocked result version aligned with its indicator version', () => {
    const results = listResultados({ page: 1, size: 100, include_historicos: true });

    for (const result of results.items) {
      const indicator = ['ind-001', 'ind-002', 'ind-003']
        .map((id) => getIndicadorById(id))
        .find((item) => item.versiones.some((version) => version.id === result.indicador_version_id));
      const version = indicator?.versiones.find((item) => item.id === result.indicador_version_id);

      expect(version).toBeDefined();
      expect(result.indicador_version_num).toBe(version?.version);
    }
  });

  it('returns inactive indicators in demo list responses', () => {
    const response = listIndicadores(1, 100);

    expect(response.items.some((indicator) => indicator.id === 'ind-003' && !indicator.activo)).toBe(true);
  });
});
