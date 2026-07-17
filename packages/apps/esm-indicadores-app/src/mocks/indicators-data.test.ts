import { resolveOrdenesMock } from './indicators-data';

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
